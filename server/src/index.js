const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const crypto = require('crypto');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const APP_NAME = 'HRAPIMS';
const APP_VERSION = '2.1.2';

// In production set JWT_SECRET yourself (Vercel env var) so sessions survive
// deploys/restarts. Falling back to a random secret is safe but means every
// cold start invalidates existing sessions — acceptable for an MVP, called
// out here so it's an obvious upgrade later.
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_TTL = '12h';

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', '..', 'dist')));

// ============ SCHEMA (auto-created, no manual migration step) ============

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id TEXT PRIMARY KEY DEFAULT 'main',
        folder_number_format TEXT DEFAULT 'F-YYYY-XXXXX',
        include_year BOOLEAN DEFAULT true,
        include_month BOOLEAN DEFAULT false,
        sequence_digits INT DEFAULT 5,
        last_sequence_number INT DEFAULT 0
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS patients (
        folder_number TEXT PRIMARY KEY,
        national_id_number TEXT,
        insurance_number TEXT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        date_of_birth DATE,
        age INT,
        is_age_estimated BOOLEAN DEFAULT false,
        gender TEXT,
        phone_number TEXT,
        location TEXT,
        height FLOAT,
        weight FLOAT,
        bmi FLOAT,
        bmi_category TEXT,
        next_of_kin_name TEXT,
        next_of_kin_contact TEXT,
        allergies TEXT,
        chronic_conditions TEXT,
        is_deleted BOOLEAN DEFAULT false,
        deleted_at TIMESTAMP,
        is_hard_deleted BOOLEAN DEFAULT false,
        hard_deleted_at TIMESTAMP,
        is_recycled BOOLEAN DEFAULT false,
        version INT DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS staff (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'STAFF',
        pin_hash TEXT NOT NULL,
        must_change_pin BOOLEAN DEFAULT true,
        is_active BOOLEAN DEFAULT true,
        failed_attempts INT DEFAULT 0,
        locked_until TIMESTAMP,
        last_login_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        action TEXT,
        entity_type TEXT,
        entity_id TEXT,
        patient_id TEXT,
        actor_id TEXT,
        actor_name TEXT,
        details TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    // Additive migration for databases created before actor tracking existed.
    await client.query(`ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS actor_id TEXT`);
    await client.query(`ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS actor_name TEXT`);
    // Helpful indexes for scale — cheap to create, no-ops if already present.
    await client.query(`CREATE INDEX IF NOT EXISTS patients_active_list_idx ON patients (is_deleted, is_hard_deleted, created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS patients_name_idx ON patients (last_name, first_name)`);
    await client.query(`CREATE INDEX IF NOT EXISTS activity_created_at_idx ON activity_logs (created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS staff_active_role_idx ON staff (is_active, role)`);

    const settingsCheck = await client.query("SELECT id FROM system_settings WHERE id = 'main'");
    if (settingsCheck.rows.length === 0) {
      await client.query("INSERT INTO system_settings (id) VALUES ('main') ON CONFLICT (id) DO NOTHING");
    }

    // Bootstrap: guarantee there is always at least one way in. Runs only
    // when the staff table is completely empty (fresh install).
    const staffCheck = await client.query('SELECT id FROM staff LIMIT 1');
    if (staffCheck.rows.length === 0) {
      const pin = String(crypto.randomInt(100000, 999999));
      const pinHash = await bcrypt.hash(pin, 10);
      await client.query(
        "INSERT INTO staff (first_name, last_name, role, pin_hash, must_change_pin) VALUES ('System', 'Administrator', 'ADMIN', $1, true)",
        [pinHash]
      );
      console.log('============================================================');
      console.log('DEFAULT ADMIN ACCOUNT CREATED');
      console.log('Name: System Administrator');
      console.log('PIN: ' + pin);
      console.log('You will be asked to set a new PIN on first login. SAVE THIS PIN.');
      console.log('============================================================');
    }
    console.log(`${APP_NAME} v${APP_VERSION}: database ready`);
  } finally {
    client.release();
  }
}

// Runs once per cold start; every request waits on this so the very first
// request after a deploy doesn't race the table-creation queries.
const dbReady = initDB().catch((err) => {
  console.error('Database initialization failed:', err.message);
  throw err;
});
app.use(async (req, res, next) => {
  try {
    await dbReady;
    next();
  } catch (err) {
    res.status(503).json({ error: 'Database is not ready. Check DATABASE_URL in your environment variables.' });
  }
});

// ============ DOMAIN HELPERS ============

// Capitalizes the first letter of every word in a name (word boundaries:
// space, hyphen, apostrophe) so "mary-jane o'brien" -> "Mary-Jane O'Brien".
function titleCase(str) {
  if (!str || typeof str !== 'string') return str;
  return str.trim().toLowerCase().replace(/(^|[\s\-'])([a-z])/g, (m, sep, ch) => sep + ch.toUpperCase());
}

function calculateAge(dob) {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}
function calculateBMI(weight, heightCm) {
  const h = heightCm / 100;
  return parseFloat((weight / (h * h)).toFixed(1));
}
function getBMICategory(bmi) {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal weight';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}

// Atomic increment avoids a read-then-write race under concurrent creates.
// Self-heals if the `system_settings` row is somehow missing instead of
// crashing on `undefined.last_sequence_number` — a bare UPDATE returning
// zero rows previously threw here with no useful error message.
async function getNextFolderNumber() {
  let result = await pool.query(
    "UPDATE system_settings SET last_sequence_number = last_sequence_number + 1 WHERE id = 'main' RETURNING *"
  );
  if (result.rows.length === 0) {
    await pool.query("INSERT INTO system_settings (id) VALUES ('main') ON CONFLICT (id) DO NOTHING");
    result = await pool.query(
      "UPDATE system_settings SET last_sequence_number = last_sequence_number + 1 WHERE id = 'main' RETURNING *"
    );
  }
  const s = result.rows[0];
  const now = new Date();
  const padded = String(s.last_sequence_number).padStart(s.sequence_digits, '0');
  let fn = s.folder_number_format;
  if (s.include_year) fn = fn.replace('YYYY', String(now.getFullYear()));
  if (s.include_month) fn = fn.replace('MM', String(now.getMonth() + 1).padStart(2, '0'));
  fn = fn.replace('XXXXX', padded).replace('XXXX', padded);
  return fn;
}

async function logActivity(req, action, entityType, entityId, patientId, details) {
  const actor = req && req.staff ? req.staff : null;
  await pool.query(
    'INSERT INTO activity_logs (action, entity_type, entity_id, patient_id, actor_id, actor_name, details) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [action, entityType, entityId || null, patientId || null, actor ? actor.id : null, actor ? actor.name : null, details ? JSON.stringify(details) : null]
  );
}

// ============ AUTH MIDDLEWARE ============

function signSession(staff) {
  return jwt.sign({ id: staff.id, role: staff.role, name: staff.first_name + ' ' + staff.last_name }, JWT_SECRET, { expiresIn: SESSION_TTL });
}
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Sign in required' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.staff = { id: payload.id, role: payload.role, name: payload.name };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
}
function requireAdmin(req, res, next) {
  if (!req.staff || req.staff.role !== 'ADMIN') return res.status(403).json({ error: 'Administrator access required' });
  next();
}

// ============ ROUTES ============

app.get('/', (req, res) => { res.sendFile(path.join(__dirname, '..', '..', 'dist', 'index.html')); });
app.get('/api/health', (req, res) => { res.json({ status: 'ok', app: APP_NAME, version: APP_VERSION }); });

// ---- Public auth routes (no session required yet) ----

// Names + roles only, for the tap-to-select login picker. No PINs, no
// timestamps, nothing an unauthenticated caller shouldn't see.
app.get('/api/staff/directory', async (req, res) => {
  try {
    const role = req.query.role === 'ADMIN' ? 'ADMIN' : 'STAFF';
    const result = await pool.query(
      'SELECT id, first_name, last_name FROM staff WHERE is_active = true AND role = $1 ORDER BY first_name, last_name',
      [role]
    );
    res.json({ staff: result.rows });
  } catch (error) { console.error(error); res.status(500).json({ error: error.message || 'Server error' }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { staffId, pin } = req.body;
    if (!staffId || !pin) return res.status(400).json({ error: 'Select your name and enter your PIN' });
    const result = await pool.query('SELECT * FROM staff WHERE id = $1', [staffId]);
    const staff = result.rows[0];
    if (!staff || !staff.is_active) return res.status(401).json({ error: 'Incorrect PIN' });
    if (staff.locked_until && new Date(staff.locked_until) > new Date()) {
      return res.status(423).json({ error: 'Account locked after too many attempts. Contact an administrator.' });
    }
    const valid = await bcrypt.compare(pin, staff.pin_hash);
    if (!valid) {
      const fails = staff.failed_attempts + 1;
      const lock = fails >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
      await pool.query('UPDATE staff SET failed_attempts = $1, locked_until = $2 WHERE id = $3', [fails, lock, staff.id]);
      return res.status(401).json({ error: lock ? 'Too many attempts. Account locked for 15 minutes.' : 'Incorrect PIN' });
    }
    await pool.query('UPDATE staff SET failed_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE id = $1', [staff.id]);
    const token = signSession(staff);
    res.json({
      token,
      staff: { id: staff.id, firstName: staff.first_name, lastName: staff.last_name, role: staff.role, mustChangePin: staff.must_change_pin },
    });
  } catch (error) { console.error(error); res.status(500).json({ error: error.message || 'Server error' }); }
});

// Every route below this line WOULD require a valid session once real
// login is switched on. For now the app uses a client-side-only "pick your
// role" pseudo-login (no credentials), so the API stays open — matching
// that reality instead of silently 401-ing a UI that never sends a token.
// The JWT/bcrypt/staff-table plumbing above is real and ready; when you
// wire up real credential auth, uncomment the line below (and the
// `requireAdmin` guards further down) to actually enforce it.
// app.use('/api', authenticate);

app.get('/api/auth/me', async (req, res) => {
  try {
    if (!req.staff) return res.status(401).json({ error: 'Not signed in' });
    const result = await pool.query('SELECT id, first_name, last_name, role, must_change_pin FROM staff WHERE id = $1', [req.staff.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const s = result.rows[0];
    res.json({ id: s.id, firstName: s.first_name, lastName: s.last_name, role: s.role, mustChangePin: s.must_change_pin });
  } catch (error) { console.error(error); res.status(500).json({ error: error.message || 'Server error' }); }
});

app.post('/api/auth/change-pin', async (req, res) => {
  try {
    if (!req.staff) return res.status(401).json({ error: 'Not signed in' });
    const { newPin } = req.body;
    if (!/^[0-9]{4,6}$/.test(newPin || '')) return res.status(400).json({ error: '4-6 digit numeric PIN required' });
    const pinHash = await bcrypt.hash(newPin, 10);
    await pool.query('UPDATE staff SET pin_hash = $1, must_change_pin = false WHERE id = $2', [pinHash, req.staff.id]);
    res.json({ message: 'PIN updated' });
  } catch (error) { console.error(error); res.status(500).json({ error: error.message || 'Server error' }); }
});

const SORT_COLUMNS = {
  name: 'last_name, first_name',
  created: 'created_at',
  age: 'age',
  folder: 'folder_number',
};
function buildSortClause(req) {
  const column = SORT_COLUMNS[req.query.sortBy] || SORT_COLUMNS.created;
  const dir = req.query.sortDir === 'asc' ? 'ASC' : 'DESC';
  return `ORDER BY ${column} ${dir}`;
}

app.get('/api/patients', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1, limit = Math.min(100, parseInt(req.query.limit) || 20), offset = (page - 1) * limit;
    const showDeleted = req.query.showDeleted === 'true';
    const where = showDeleted ? 'is_hard_deleted = false' : 'is_hard_deleted = false AND is_deleted = false';
    const result = await pool.query(`SELECT * FROM patients WHERE ${where} ${buildSortClause(req)} LIMIT $1 OFFSET $2`, [limit, offset]);
    const count = await pool.query(`SELECT COUNT(*) FROM patients WHERE ${where}`);
    const total = parseInt(count.rows[0].count);
    res.json({ patients: result.rows, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) { console.error(error); res.status(500).json({ error: error.message || 'Server error' }); }
});

app.get('/api/patients/search', async (req, res) => {
  try {
    const query = req.query.query || '';
    if (query.length < 3) return res.status(400).json({ error: 'Minimum 3 characters' });
    const page = parseInt(req.query.page) || 1, limit = Math.min(100, parseInt(req.query.limit) || 20), offset = (page - 1) * limit;
    const q = '%' + query + '%';
    const sql = `SELECT * FROM patients WHERE is_hard_deleted = false AND (
      first_name ILIKE $1 OR last_name ILIKE $1 OR folder_number ILIKE $1 OR phone_number ILIKE $1 OR
      national_id_number ILIKE $1 OR insurance_number ILIKE $1 OR location ILIKE $1 OR
      allergies ILIKE $1 OR chronic_conditions ILIKE $1
    )`;
    const result = await pool.query(sql + ` ${buildSortClause(req)} LIMIT $2 OFFSET $3`, [q, limit, offset]);
    const count = await pool.query(sql.replace('SELECT *', 'SELECT COUNT(*)'), [q]);
    const total = parseInt(count.rows[0].count);
    res.json({ patients: result.rows, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) { console.error(error); res.status(500).json({ error: error.message || 'Server error' }); }
});

app.get('/api/patients/:folderNumber', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM patients WHERE folder_number = $1', [req.params.folderNumber]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (error) { console.error(error); res.status(500).json({ error: error.message || 'Server error' }); }
});

app.post('/api/patients/check-unique', async (req, res) => {
  try {
    const { nationalIdNumber, insuranceNumber, excludeFolderNumber } = req.body;
    const result = {};
    if (nationalIdNumber) {
      const check = await pool.query(
        'SELECT * FROM patients WHERE national_id_number = $1 AND is_hard_deleted = false' + (excludeFolderNumber ? ' AND folder_number != $2' : ''),
        excludeFolderNumber ? [nationalIdNumber, excludeFolderNumber] : [nationalIdNumber]
      );
      result.nationalId = check.rows.length > 0 ? { exists: true, patient: check.rows[0] } : { exists: false };
    }
    if (insuranceNumber) {
      const check = await pool.query(
        'SELECT * FROM patients WHERE insurance_number = $1 AND is_hard_deleted = false' + (excludeFolderNumber ? ' AND folder_number != $2' : ''),
        excludeFolderNumber ? [insuranceNumber, excludeFolderNumber] : [insuranceNumber]
      );
      result.insurance = check.rows.length > 0 ? { exists: true, patient: check.rows[0] } : { exists: false };
    }
    res.json(result);
  } catch (error) { console.error(error); res.status(500).json({ error: error.message || 'Server error' }); }
});

app.post('/api/patients', async (req, res) => {
  const client = await pool.connect();
  try {
    const d = req.body;
    if (!d.firstName || !d.lastName || !d.gender || !d.location) {
      return res.status(400).json({ error: 'First name, last name, gender, and location are required' });
    }
    if (d.insuranceNumber && !/^\d{1,8}$/.test(d.insuranceNumber)) {
      return res.status(400).json({ error: 'Insurance number must be up to 8 digits' });
    }
    if (d.nationalIdNumber && !/^GHA-\d{9}-\d$/.test(d.nationalIdNumber)) {
      return res.status(400).json({ error: 'National ID must be in the format GHA-XXXXXXXXX-X' });
    }
    if (d.nationalIdNumber) {
      const check = await client.query('SELECT * FROM patients WHERE national_id_number = $1 AND is_hard_deleted = false', [d.nationalIdNumber]);
      if (check.rows.length > 0) return res.status(409).json({ error: 'National ID already registered', existingPatient: check.rows[0] });
    }
    if (d.insuranceNumber) {
      const check = await client.query('SELECT * FROM patients WHERE insurance_number = $1 AND is_hard_deleted = false', [d.insuranceNumber]);
      if (check.rows.length > 0) return res.status(409).json({ error: 'Insurance already registered', existingPatient: check.rows[0] });
    }
    // A DOB derived from an age input (rather than typed in directly) is
    // always an estimate. The client tells us which one the user actually
    // edited via ageEstimated; we fall back to the old inference if it's
    // omitted (e.g. direct API callers) so behavior doesn't silently change.
    let dob = null, age = null, estimated = false;
    if (d.dateOfBirth) {
      dob = new Date(d.dateOfBirth);
      age = d.age != null ? d.age : calculateAge(dob);
      estimated = d.ageEstimated !== undefined ? !!d.ageEstimated : false;
    } else if (d.age) {
      dob = new Date(new Date().getFullYear() - d.age, 0, 1);
      age = d.age;
      estimated = true;
    }
    let bmi = null, bmiCat = null;
    if (d.height && d.weight) { bmi = calculateBMI(d.weight, d.height); bmiCat = getBMICategory(bmi); }
    const firstName = titleCase(d.firstName);
    const lastName = titleCase(d.lastName);
    const nextOfKinName = d.nextOfKinName ? titleCase(d.nextOfKinName) : null;
    const folderNumber = await getNextFolderNumber();
    await client.query(
      `INSERT INTO patients (folder_number, national_id_number, insurance_number, first_name, last_name, date_of_birth, age, is_age_estimated, gender, phone_number, location, height, weight, bmi, bmi_category, next_of_kin_name, next_of_kin_contact, allergies, chronic_conditions)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
      [folderNumber, d.nationalIdNumber || null, d.insuranceNumber || null, firstName, lastName, dob, age, estimated, d.gender, d.phoneNumber || null, d.location, d.height || null, d.weight || null, bmi, bmiCat, nextOfKinName, d.nextOfKinContact || null, d.allergies || null, d.chronicConditions || null]
    );
    await logActivity(req, 'CREATE', 'PATIENT', folderNumber, folderNumber, { initialData: d });
    const result = await client.query('SELECT * FROM patients WHERE folder_number = $1', [folderNumber]);
    res.status(201).json(result.rows[0]);
  } catch (error) { console.error('Create error:', error.message); res.status(500).json({ error: error.message || 'Server error' }); }
  finally { client.release(); }
});

app.put('/api/patients/:folderNumber', async (req, res) => {
  try {
    const d = req.body, fn = req.params.folderNumber;
    const existing = await pool.query('SELECT * FROM patients WHERE folder_number = $1', [fn]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const e = existing.rows[0];
    if (d.version && d.version !== e.version) {
      return res.status(409).json({ error: 'Record was updated by someone else. Please refresh and try again.' });
    }
    if (d.insuranceNumber && !/^\d{1,8}$/.test(d.insuranceNumber)) {
      return res.status(400).json({ error: 'Insurance number must be up to 8 digits' });
    }
    if (d.nationalIdNumber && !/^GHA-\d{9}-\d$/.test(d.nationalIdNumber)) {
      return res.status(400).json({ error: 'National ID must be in the format GHA-XXXXXXXXX-X' });
    }
    let dob = e.date_of_birth, age = e.age, estimated = e.is_age_estimated;
    if (d.dateOfBirth) {
      dob = new Date(d.dateOfBirth);
      age = d.age != null ? d.age : calculateAge(dob);
      estimated = d.ageEstimated !== undefined ? !!d.ageEstimated : false;
    } else if (d.age && d.age !== e.age) {
      dob = new Date(new Date().getFullYear() - d.age, 0, 1); age = d.age; estimated = true;
    }
    const h = d.height !== undefined ? d.height : e.height;
    const w = d.weight !== undefined ? d.weight : e.weight;
    let bmi = e.bmi, bmiCat = e.bmi_category;
    if (h && w) { bmi = calculateBMI(w, h); bmiCat = getBMICategory(bmi); }

    const fields = ['national_id_number', 'insurance_number', 'first_name', 'last_name', 'gender', 'phone_number', 'location', 'height', 'weight', 'next_of_kin_name', 'next_of_kin_contact', 'allergies', 'chronic_conditions'];
    const newVals = [
      d.nationalIdNumber !== undefined ? d.nationalIdNumber : e.national_id_number,
      d.insuranceNumber !== undefined ? d.insuranceNumber : e.insurance_number,
      d.firstName ? titleCase(d.firstName) : e.first_name,
      d.lastName ? titleCase(d.lastName) : e.last_name,
      d.gender || e.gender,
      d.phoneNumber !== undefined ? d.phoneNumber : e.phone_number, d.location || e.location, h, w,
      d.nextOfKinName !== undefined ? (d.nextOfKinName ? titleCase(d.nextOfKinName) : d.nextOfKinName) : e.next_of_kin_name,
      d.nextOfKinContact !== undefined ? d.nextOfKinContact : e.next_of_kin_contact,
      d.allergies !== undefined ? d.allergies : e.allergies,
      d.chronicConditions !== undefined ? d.chronicConditions : e.chronic_conditions,
    ];
    const changes = {};
    fields.forEach((f, i) => { if (e[f] != newVals[i]) changes[f] = { from: e[f], to: newVals[i] }; });

    await pool.query(
      `UPDATE patients SET national_id_number=$1, insurance_number=$2, first_name=$3, last_name=$4, date_of_birth=$5, age=$6, is_age_estimated=$7, gender=$8, phone_number=$9, location=$10, height=$11, weight=$12, bmi=$13, bmi_category=$14, next_of_kin_name=$15, next_of_kin_contact=$16, allergies=$17, chronic_conditions=$18, version=version+1, updated_at=NOW() WHERE folder_number=$19`,
      [...newVals, dob, age, estimated, bmi, bmiCat, fn]
    );
    await logActivity(req, 'UPDATE', 'PATIENT', fn, fn, { changes });
    const result = await pool.query('SELECT * FROM patients WHERE folder_number = $1', [fn]);
    res.json(result.rows[0]);
  } catch (error) { console.error('Update error:', error.message); res.status(500).json({ error: error.message || 'Server error' }); }
});

app.delete('/api/patients/:folderNumber', async (req, res) => {
  try {
    await pool.query('UPDATE patients SET is_deleted = true, deleted_at = NOW() WHERE folder_number = $1', [req.params.folderNumber]);
    await logActivity(req, 'SOFT_DELETE', 'PATIENT', req.params.folderNumber, req.params.folderNumber);
    res.json({ message: 'Deleted' });
  } catch (error) { console.error(error); res.status(500).json({ error: error.message || 'Server error' }); }
});

app.post('/api/patients/:folderNumber/restore', async (req, res) => {
  try {
    await pool.query('UPDATE patients SET is_deleted = false, deleted_at = NULL WHERE folder_number = $1', [req.params.folderNumber]);
    await logActivity(req, 'RESTORE', 'PATIENT', req.params.folderNumber, req.params.folderNumber);
    res.json({ message: 'Restored' });
  } catch (error) { console.error(error); res.status(500).json({ error: error.message || 'Server error' }); }
});

app.delete('/api/patients/:folderNumber/permanent', async (req, res) => {
  try {
    if (req.body.confirmation !== 'DELETE') return res.status(400).json({ error: 'Type DELETE to confirm' });
    await pool.query('UPDATE patients SET is_hard_deleted = true, hard_deleted_at = NOW(), is_deleted = false, deleted_at = NULL WHERE folder_number = $1', [req.params.folderNumber]);
    await logActivity(req, 'HARD_DELETE', 'PATIENT', req.params.folderNumber, req.params.folderNumber);
    res.json({ message: 'Permanently deleted' });
  } catch (error) { console.error(error); res.status(500).json({ error: error.message || 'Server error' }); }
});

app.post('/api/patients/merge', async (req, res) => {
  try {
    const { targetFolderNumber, sourceFolderNumber, confirmation } = req.body;
    if (confirmation !== 'MERGE') return res.status(400).json({ error: 'Type MERGE to confirm' });
    const target = await pool.query('SELECT * FROM patients WHERE folder_number = $1', [targetFolderNumber]);
    const source = await pool.query('SELECT * FROM patients WHERE folder_number = $1', [sourceFolderNumber]);
    if (target.rows.length === 0 || source.rows.length === 0) return res.status(404).json({ error: 'One or both patients not found' });
    const t = target.rows[0], s = source.rows[0];
    const conflicts = {};
    const fields = ['national_id_number', 'insurance_number', 'date_of_birth', 'age', 'gender', 'phone_number', 'location', 'height', 'weight', 'next_of_kin_name', 'next_of_kin_contact', 'allergies', 'chronic_conditions'];
    const updates = {};
    fields.forEach((f) => {
      if (!t[f] && s[f]) updates[f] = s[f];
      else if (t[f] && s[f] && t[f] !== s[f]) conflicts[f] = { target: t[f], source: s[f] };
    });
    if (Object.keys(updates).length > 0) {
      const setClauses = Object.keys(updates).map((k, i) => k + ' = $' + (i + 1));
      await pool.query('UPDATE patients SET ' + setClauses.join(', ') + ' WHERE folder_number = $' + (Object.keys(updates).length + 1), [...Object.values(updates), targetFolderNumber]);
    }
    await pool.query('UPDATE patients SET is_deleted = true, deleted_at = NOW() WHERE folder_number = $1', [sourceFolderNumber]);
    await logActivity(req, 'MERGE', 'PATIENT', targetFolderNumber, targetFolderNumber, { mergedFrom: sourceFolderNumber, conflicts });
    res.json({ message: 'Merged', conflicts: Object.keys(conflicts).length > 0 ? conflicts : null });
  } catch (error) { console.error('Merge error:', error.message); res.status(500).json({ error: error.message || 'Server error' }); }
});

app.get('/api/activity', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1, limit = Math.min(100, parseInt(req.query.limit) || 20), offset = (page - 1) * limit;
    let where = '1=1', params = [], i = 1;
    if (req.query.action) { where += ` AND action = $${i++}`; params.push(req.query.action); }
    if (req.query.patientId) { where += ` AND patient_id = $${i++}`; params.push(req.query.patientId); }
    if (req.query.startDate) { where += ` AND created_at >= $${i++}`; params.push(req.query.startDate); }
    if (req.query.endDate) { where += ` AND created_at <= $${i++}`; params.push(req.query.endDate + 'T23:59:59'); }
    const countParams = [...params];
    params.push(limit, offset);
    const result = await pool.query(`SELECT * FROM activity_logs WHERE ${where} ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i}`, params);
    const count = await pool.query(`SELECT COUNT(*) FROM activity_logs WHERE ${where}`, countParams);
    const total = parseInt(count.rows[0].count);
    res.json({ logs: result.rows, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) { console.error(error); res.status(500).json({ error: error.message || 'Server error' }); }
});

app.get('/api/activity/filters', async (req, res) => {
  try {
    const actions = await pool.query('SELECT DISTINCT action FROM activity_logs ORDER BY action');
    res.json({ actions: actions.rows.map((a) => a.action) });
  } catch (error) { console.error(error); res.status(500).json({ error: error.message || 'Server error' }); }
});

// ---- Staff management (admin only) ----

app.get('/api/staff', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, first_name, last_name, role, is_active, must_change_pin, failed_attempts, locked_until, last_login_at, created_at FROM staff ORDER BY created_at DESC'
    );
    res.json({ staff: result.rows });
  } catch (error) { console.error(error); res.status(500).json({ error: error.message || 'Server error' }); }
});

app.post('/api/staff', async (req, res) => {
  try {
    const { firstName, lastName, role } = req.body;
    if (!firstName || !lastName) return res.status(400).json({ error: 'First and last name are required' });
    const finalRole = role === 'ADMIN' ? 'ADMIN' : 'STAFF';
    const pin = String(crypto.randomInt(1000, 9999));
    const pinHash = await bcrypt.hash(pin, 10);
    const result = await pool.query(
      'INSERT INTO staff (first_name, last_name, role, pin_hash, must_change_pin) VALUES ($1,$2,$3,$4,true) RETURNING id, first_name, last_name, role, is_active, created_at',
      [titleCase(firstName), titleCase(lastName), finalRole, pinHash]
    );
    await logActivity(req, 'CREATE', 'STAFF', result.rows[0].id, null, { firstName, lastName, role: finalRole });
    res.status(201).json({ ...result.rows[0], temporaryPin: pin });
  } catch (error) { console.error(error); res.status(500).json({ error: error.message || 'Server error' }); }
});

app.put('/api/staff/:id', async (req, res) => {
  try {
    const { firstName, lastName, role, isActive } = req.body;
    const existing = await pool.query('SELECT * FROM staff WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    // Guard rail: never let the last active admin lock themselves (or every
    // admin) out of the system by demoting/deactivating the final admin.
    if ((role && role !== 'ADMIN') || isActive === false) {
      if (existing.rows[0].role === 'ADMIN') {
        const admins = await pool.query("SELECT COUNT(*) FROM staff WHERE role = 'ADMIN' AND is_active = true AND id != $1", [req.params.id]);
        if (parseInt(admins.rows[0].count) === 0) return res.status(400).json({ error: 'At least one active administrator must remain' });
      }
    }
    await pool.query(
      'UPDATE staff SET first_name = COALESCE($1, first_name), last_name = COALESCE($2, last_name), role = COALESCE($3, role), is_active = COALESCE($4, is_active), updated_at = NOW() WHERE id = $5',
      [firstName ? titleCase(firstName) : null, lastName ? titleCase(lastName) : null, role || null, isActive !== undefined ? isActive : null, req.params.id]
    );
    await logActivity(req, 'UPDATE', 'STAFF', req.params.id, null, { firstName, lastName, role, isActive });
    res.json({ message: 'Updated' });
  } catch (error) { console.error(error); res.status(500).json({ error: error.message || 'Server error' }); }
});

app.post('/api/staff/:id/reset-pin', async (req, res) => {
  try {
    const pin = String(crypto.randomInt(1000, 9999));
    const pinHash = await bcrypt.hash(pin, 10);
    await pool.query('UPDATE staff SET pin_hash = $1, must_change_pin = true, failed_attempts = 0, locked_until = NULL WHERE id = $2', [pinHash, req.params.id]);
    await logActivity(req, 'PIN_RESET', 'STAFF', req.params.id, null);
    res.json({ temporaryPin: pin });
  } catch (error) { console.error(error); res.status(500).json({ error: error.message || 'Server error' }); }
});

app.delete('/api/staff/:id', async (req, res) => {
  try {
    // req.staff only exists once real login (the `authenticate` middleware
    // above) is switched back on — guard instead of assuming it's set.
    if (req.staff && req.params.id === req.staff.id) return res.status(400).json({ error: 'You cannot remove your own account' });
    const existing = await pool.query('SELECT * FROM staff WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (existing.rows[0].role === 'ADMIN') {
      const admins = await pool.query("SELECT COUNT(*) FROM staff WHERE role = 'ADMIN' AND is_active = true AND id != $1", [req.params.id]);
      if (parseInt(admins.rows[0].count) === 0) return res.status(400).json({ error: 'At least one active administrator must remain' });
    }
    await pool.query('DELETE FROM staff WHERE id = $1', [req.params.id]);
    await logActivity(req, 'DELETE', 'STAFF', req.params.id, null);
    res.json({ message: 'Removed' });
  } catch (error) { console.error(error); res.status(500).json({ error: error.message || 'Server error' }); }
});

app.get('/api/settings/folder-format', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM system_settings WHERE id = 'main'");
    res.json(result.rows[0]);
  } catch (error) { console.error(error); res.status(500).json({ error: error.message || 'Server error' }); }
});

app.put('/api/settings/folder-format', async (req, res) => {
  try {
    const { folderNumberFormat, includeYear, includeMonth, sequenceDigits } = req.body;
    await pool.query(
      `UPDATE system_settings SET folder_number_format = COALESCE($1, folder_number_format), include_year = COALESCE($2, include_year), include_month = COALESCE($3, include_month), sequence_digits = COALESCE($4, sequence_digits) WHERE id = 'main'`,
      [folderNumberFormat || null, includeYear !== undefined ? includeYear : null, includeMonth !== undefined ? includeMonth : null, sequenceDigits || null]
    );
    const result = await pool.query("SELECT * FROM system_settings WHERE id = 'main'");
    res.json(result.rows[0]);
  } catch (error) { console.error(error); res.status(500).json({ error: error.message || 'Server error' }); }
});

app.post('/api/export/backup', async (req, res) => {
  try {
    const patients = await pool.query('SELECT * FROM patients WHERE is_hard_deleted = false');
    res.json({ message: 'Backup ready', recordCount: patients.rows.length, data: patients.rows });
  } catch (error) { console.error(error); res.status(500).json({ error: error.message || 'Server error' }); }
});

function toCsvRow(values) {
  return values.map((v) => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',');
}

app.get('/api/export/patients', async (req, res) => {
  try {
    const patients = await pool.query('SELECT * FROM patients WHERE is_hard_deleted = false ORDER BY created_at DESC');
    let csv = 'Folder Number,First Name,Last Name,DOB,Age,Gender,Phone,Location,National ID,Insurance,Height,Weight,BMI,Category,NOK Name,NOK Contact,Allergies,Conditions,Status,Created\n';
    patients.rows.forEach((p) => {
      csv += toCsvRow([p.folder_number, p.first_name, p.last_name, p.date_of_birth || '', p.age || '', p.gender, p.phone_number || '', p.location, p.national_id_number || '', p.insurance_number || '', p.height || '', p.weight || '', p.bmi || '', p.bmi_category || '', p.next_of_kin_name || '', p.next_of_kin_contact || '', p.allergies || '', p.chronic_conditions || '', p.is_deleted ? 'Deleted' : 'Active', p.created_at]) + '\n';
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=hrapims-patients.csv');
    res.send(csv);
  } catch (error) { console.error(error); res.status(500).json({ error: error.message || 'Server error' }); }
});

app.get('/api/export/activity', async (req, res) => {
  try {
    let where = '1=1', params = [];
    if (req.query.startDate) { where += ` AND created_at >= $${params.length + 1}`; params.push(req.query.startDate); }
    if (req.query.endDate) { where += ` AND created_at <= $${params.length + 1}`; params.push(req.query.endDate + 'T23:59:59'); }
    const logs = await pool.query(`SELECT * FROM activity_logs WHERE ${where} ORDER BY created_at DESC`, params);
    let csv = 'Timestamp,Staff,Action,Entity Type,Entity ID,Details\n';
    logs.rows.forEach((l) => { csv += toCsvRow([l.created_at, l.actor_name || 'System', l.action, l.entity_type, l.entity_id || '', l.details || '']) + '\n'; });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=hrapims-activity.csv');
    res.send(csv);
  } catch (error) { console.error(error); res.status(500).json({ error: error.message || 'Server error' }); }
});

// ============ START / EXPORT ============
// Direct execution (local dev) starts a normal server; imported as a module
// (Vercel's serverless runtime, via api/index.js) it just exports the app.
if (require.main === module) {
  dbReady
    .then(() => app.listen(PORT, '0.0.0.0', () => console.log(`${APP_NAME} v${APP_VERSION} running on port ${PORT}`)))
    .catch((err) => { console.error('Failed to start:', err); process.exit(1); });
}

module.exports = app;
