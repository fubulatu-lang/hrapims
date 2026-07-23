// ============ FOLDER NUMBER ENGINE (Phase 3) ============
//
// Everything folder-number-related lives here, and ONLY here. The patient
// module (server/src/index.js's /api/patients routes) is not allowed to
// know how a folder number is generated, validated, reserved, or
// assigned — it just calls into this service and gets back either a
// number or an error. That separation is deliberate: it's what makes it
// possible to change numbering rules later without touching patient
// registration at all, and it's exactly the rule this phase's spec led
// with.
//
// State model, briefly:
// - folder_number_config: one row, holds the prefix and the LFNI (Last
//   Folder Number Issued) — the high-water mark of ever-assigned numbers.
// - folder_number_ledger: one row per folder number that has ever existed
//   in the system (available, assigned, or blocked). This is the
//   permanent record — it's never deleted, only its `status` changes.
// - folder_number_pool: a materialized view of which ledger rows are
//   *currently* available, so "what's the next number" doesn't require
//   scanning the whole ledger. rebuildFolderPool() is what keeps this in
//   sync if it ever drifts.
// - folder_number_reservations: short-lived (10 min) holds on a specific
//   number while one staff member is mid-registration, so two people
//   can't both end up assigned the same number.
// - folder_number_audit: an append-only log of every state change, for
//   the eventual admin-facing history view (Phase 5).
//
// Concurrency: reserve/assign both use a dedicated client with an
// explicit transaction and `SELECT ... FOR UPDATE`, not the shared pool's
// implicit-transaction-per-query behavior — two simultaneous requests for
// "the next number" must never be able to both grab the same one.

const RESERVATION_TTL_MINUTES = 10;

function createFolderNumberService(pool) {
  async function getConfig(client = pool) {
    const result = await client.query("SELECT * FROM folder_number_config WHERE id = 'main'");
    if (result.rows.length === 0) {
      throw new Error('Folder numbering has not been configured yet. An administrator must set a prefix first.');
    }
    return result.rows[0];
  }

  function formatFullNumber(prefix, sequenceNumber) {
    return `${prefix}${sequenceNumber}`;
  }

  // Releases any reservations whose TTL has passed. Called at the top of
  // every read/write path below rather than on a timer — there's no
  // long-running process to host a scheduler (this runs on Vercel's
  // serverless functions), so "expire lazily, on next access" is the
  // correct shape here, not a bug. Phase 5 can add a Vercel Cron sweep on
  // top of this for tidiness; it isn't required for correctness.
  async function expireStaleReservations(client = pool) {
    await client.query(
      `UPDATE folder_number_reservations SET status = 'EXPIRED'
       WHERE status = 'ACTIVE' AND expires_at < NOW()`
    );
  }

  // Ensures a ledger (+ pool) row exists for a given sequence number,
  // creating it as AVAILABLE if this is the first time it's been
  // referenced. The ledger is populated lazily like this — on demand, as
  // numbers are approached — rather than pre-generating a huge batch of
  // future rows up front.
  async function ensureLedgerRow(client, prefix, sequenceNumber) {
    const fullFolderNumber = formatFullNumber(prefix, sequenceNumber);
    const existing = await client.query('SELECT * FROM folder_number_ledger WHERE full_folder_number = $1', [fullFolderNumber]);
    if (existing.rows.length > 0) return existing.rows[0];
    const inserted = await client.query(
      `INSERT INTO folder_number_ledger (prefix, sequence_number, full_folder_number, status)
       VALUES ($1, $2, $3, 'AVAILABLE') RETURNING *`,
      [prefix, sequenceNumber, fullFolderNumber]
    );
    await client.query(
      `INSERT INTO folder_number_pool (folder_number_id, status) VALUES ($1, 'AVAILABLE')
       ON CONFLICT (folder_number_id) DO NOTHING`,
      [inserted.rows[0].id]
    );
    return inserted.rows[0];
  }

  /**
   * NAFN — Next Available Folder Number. Prefers the lowest-numbered
   * AVAILABLE, unreserved slot in the pool (this is how a released or
   * historical number gets reused instead of numbers only ever going up);
   * falls back to LFNI + 1 when the pool has nothing free.
   * @returns {Promise<{sequenceNumber: number, fullFolderNumber: string, prefix: string, source: 'pool'|'new'}>}
   */
  async function calculateNAFN(client = pool) {
    await expireStaleReservations(client);
    const config = await getConfig(client);

    const poolResult = await client.query(`
      SELECT l.id, l.sequence_number, l.full_folder_number
      FROM folder_number_pool p
      JOIN folder_number_ledger l ON l.id = p.folder_number_id
      WHERE p.status = 'AVAILABLE' AND l.status = 'AVAILABLE'
        AND NOT EXISTS (
          SELECT 1 FROM folder_number_reservations r
          WHERE r.folder_number_id = l.id AND r.status = 'ACTIVE' AND r.expires_at > NOW()
        )
      ORDER BY l.sequence_number ASC
      LIMIT 1
    `);
    if (poolResult.rows.length > 0) {
      const row = poolResult.rows[0];
      return { sequenceNumber: row.sequence_number, fullFolderNumber: row.full_folder_number, prefix: config.prefix, source: 'pool' };
    }

    const nextSequence = parseInt(config.lfni, 10) + 1;
    await ensureLedgerRow(client, config.prefix, nextSequence);
    return { sequenceNumber: nextSequence, fullFolderNumber: formatFullNumber(config.prefix, nextSequence), prefix: config.prefix, source: 'new' };
  }

  /** Read-only preview of the next number — does not reserve or hold anything. */
  async function generateFolderNumber() {
    return calculateNAFN();
  }

  /**
   * Checks whether a *manually typed* folder number can legally be used
   * right now: correct prefix, exists in the ledger, currently AVAILABLE,
   * and not actively reserved by someone else.
   * @returns {Promise<{valid: boolean, error?: string}>}
   */
  async function validateFolderNumber(fullFolderNumber) {
    await expireStaleReservations();
    const config = await getConfig();
    if (!fullFolderNumber || typeof fullFolderNumber !== 'string') {
      return { valid: false, error: 'Folder number is required' };
    }
    if (config.prefix && !fullFolderNumber.startsWith(config.prefix)) {
      return { valid: false, error: `Folder number must start with "${config.prefix}"` };
    }
    const result = await pool.query('SELECT * FROM folder_number_ledger WHERE full_folder_number = $1', [fullFolderNumber]);
    const row = result.rows[0];
    if (!row) return { valid: false, error: 'That folder number has not been issued and is not currently available' };
    if (row.status === 'ASSIGNED') return { valid: false, error: 'That folder number is already assigned to a patient' };
    if (row.status === 'BLOCKED') return { valid: false, error: `That folder number is blocked${row.blocked_reason ? `: ${row.blocked_reason}` : ''}` };
    const activeReservation = await pool.query(
      `SELECT 1 FROM folder_number_reservations WHERE folder_number_id = $1 AND status = 'ACTIVE' AND expires_at > NOW()`,
      [row.id]
    );
    if (activeReservation.rows.length > 0) return { valid: false, error: 'That folder number is currently reserved by another staff member' };
    return { valid: true };
  }

  /**
   * Holds a folder number for up to 10 minutes so one staff member's
   * in-progress registration can't collide with another's. If no specific
   * number is requested, reserves the current NAFN.
   * @param {{fullFolderNumber?: string, userId: string}} params
   * @returns {Promise<{reservationId: string, fullFolderNumber: string, sequenceNumber: number, expiresAt: string}>}
   */
  async function reserveFolderNumber({ fullFolderNumber, userId }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await expireStaleReservations(client);
      const config = await getConfig(client);

      let ledgerRow;
      if (fullFolderNumber) {
        const result = await client.query('SELECT * FROM folder_number_ledger WHERE full_folder_number = $1 FOR UPDATE', [fullFolderNumber]);
        ledgerRow = result.rows[0];
        if (!ledgerRow) throw new Error('That folder number has not been issued and is not currently available');
      } else {
        const nafn = await calculateNAFN(client);
        const result = await client.query('SELECT * FROM folder_number_ledger WHERE full_folder_number = $1 FOR UPDATE', [nafn.fullFolderNumber]);
        ledgerRow = result.rows[0];
      }

      if (ledgerRow.status !== 'AVAILABLE') {
        throw new Error(ledgerRow.status === 'ASSIGNED' ? 'That folder number is already assigned to a patient' : 'That folder number is blocked');
      }
      const existingReservation = await client.query(
        `SELECT 1 FROM folder_number_reservations WHERE folder_number_id = $1 AND status = 'ACTIVE' AND expires_at > NOW()`,
        [ledgerRow.id]
      );
      if (existingReservation.rows.length > 0) throw new Error('That folder number is currently reserved by another staff member');

      const expiresAt = new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000);
      const reservation = await client.query(
        `INSERT INTO folder_number_reservations (folder_number_id, user_id, status, expires_at) VALUES ($1, $2, 'ACTIVE', $3) RETURNING *`,
        [ledgerRow.id, userId || null, expiresAt]
      );
      await client.query(
        `INSERT INTO folder_number_audit (folder_number_id, action, new_value, user_id) VALUES ($1, 'RESERVE', $2, $3)`,
        [ledgerRow.id, ledgerRow.full_folder_number, userId || null]
      );
      await client.query('COMMIT');
      return {
        reservationId: reservation.rows[0].id,
        fullFolderNumber: ledgerRow.full_folder_number,
        sequenceNumber: ledgerRow.sequence_number,
        expiresAt: expiresAt.toISOString(),
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Permanently assigns a folder number to a patient — the terminal step
   * after registration succeeds. Advances LFNI if this number is now the
   * highest ever issued (LFNI only ever moves forward).
   * @param {{fullFolderNumber: string, patientId: string, userId: string, reservationId?: string}} params
   */
  async function assignFolderNumber({ fullFolderNumber, patientId, userId, reservationId }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query('SELECT * FROM folder_number_ledger WHERE full_folder_number = $1 FOR UPDATE', [fullFolderNumber]);
      const ledgerRow = result.rows[0];
      if (!ledgerRow) throw new Error('That folder number does not exist');
      if (ledgerRow.status === 'ASSIGNED') throw new Error('That folder number is already assigned to a patient');
      if (ledgerRow.status === 'BLOCKED') throw new Error('That folder number is blocked');

      if (reservationId) {
        const reservation = await client.query(
          `SELECT * FROM folder_number_reservations WHERE id = $1 AND folder_number_id = $2 AND status = 'ACTIVE' AND expires_at > NOW()`,
          [reservationId, ledgerRow.id]
        );
        if (reservation.rows.length === 0) throw new Error('Your reservation for this folder number has expired. Please request a new number.');
        await client.query(`UPDATE folder_number_reservations SET status = 'COMPLETED' WHERE id = $1`, [reservationId]);
      }

      await client.query(
        `UPDATE folder_number_ledger SET status = 'ASSIGNED', patient_id = $1, updated_at = NOW() WHERE id = $2`,
        [patientId, ledgerRow.id]
      );
      await client.query(`DELETE FROM folder_number_pool WHERE folder_number_id = $1`, [ledgerRow.id]);
      if (ledgerRow.sequence_number != null) {
        await client.query(
          `UPDATE folder_number_config SET lfni = GREATEST(lfni, $1), updated_at = NOW() WHERE id = 'main'`,
          [ledgerRow.sequence_number]
        );
      }
      await client.query(
        `INSERT INTO folder_number_audit (folder_number_id, action, old_value, new_value, user_id) VALUES ($1, 'ASSIGN', 'AVAILABLE', $2, $3)`,
        [ledgerRow.id, patientId, userId || null]
      );
      await client.query('COMMIT');
      return { fullFolderNumber: ledgerRow.full_folder_number, sequenceNumber: ledgerRow.sequence_number };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Releases a reservation early (e.g. the person cancelled the form)
   * without waiting for the 10-minute TTL. Does not change the ledger
   * row's status — it was AVAILABLE the whole time, a reservation is a
   * hold, not a state of the number itself.
   */
  async function releaseFolderNumber({ reservationId, userId, reason }) {
    const result = await pool.query(
      `UPDATE folder_number_reservations SET status = 'RELEASED' WHERE id = $1 AND status = 'ACTIVE' RETURNING *`,
      [reservationId]
    );
    if (result.rows.length === 0) return { released: false };
    const reservation = result.rows[0];
    await pool.query(
      `INSERT INTO folder_number_audit (folder_number_id, action, user_id, reason) VALUES ($1, 'RELEASE', $2, $3)`,
      [reservation.folder_number_id, userId || null, reason || null]
    );
    return { released: true };
  }

  /**
   * Reconciliation pass: makes folder_number_pool match reality —
   * removes pool rows whose ledger entry is no longer AVAILABLE, and adds
   * any AVAILABLE ledger rows that are missing from the pool. Safe to run
   * any time; this is what "the pool drifted" gets fixed by, not
   * something that needs to run on a schedule for correctness (lazy
   * ensureLedgerRow keeps day-to-day operation correct without it).
   */
  async function rebuildFolderPool() {
    const removed = await pool.query(`
      DELETE FROM folder_number_pool p
      WHERE NOT EXISTS (
        SELECT 1 FROM folder_number_ledger l WHERE l.id = p.folder_number_id AND l.status = 'AVAILABLE'
      )
      RETURNING p.id
    `);
    const added = await pool.query(`
      INSERT INTO folder_number_pool (folder_number_id, status)
      SELECT l.id, 'AVAILABLE' FROM folder_number_ledger l
      WHERE l.status = 'AVAILABLE'
        AND NOT EXISTS (SELECT 1 FROM folder_number_pool p WHERE p.folder_number_id = l.id)
      RETURNING id
    `);
    return { removed: removed.rows.length, added: added.rows.length };
  }

  return {
    getConfig,
    generateFolderNumber,
    validateFolderNumber,
    reserveFolderNumber,
    assignFolderNumber,
    releaseFolderNumber,
    rebuildFolderPool,
  };
}

module.exports = { createFolderNumberService };
