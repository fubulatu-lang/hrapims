import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';
import { Chip } from '../ui/Chip';
import { titleCase, formatDate } from '../../lib/format';

const COMPARE_FIELDS = [
  { key: 'first_name', label: 'First Name', format: titleCase },
  { key: 'last_name', label: 'Last Name', format: titleCase },
  { key: 'date_of_birth', label: 'Date of Birth', format: (v) => (v ? formatDate(v) : '') },
  { key: 'age', label: 'Age' },
  { key: 'gender', label: 'Gender' },
  { key: 'phone_number', label: 'Phone' },
  { key: 'location', label: 'Location' },
  { key: 'national_id_number', label: 'National ID' },
  { key: 'insurance_number', label: 'Insurance Number' },
  { key: 'height', label: 'Height (cm)' },
  { key: 'weight', label: 'Weight (kg)' },
  { key: 'next_of_kin_name', label: 'Next of Kin Name', format: titleCase },
  { key: 'next_of_kin_contact', label: 'Next of Kin Contact' },
  { key: 'allergies', label: 'Allergies' },
  { key: 'chronic_conditions', label: 'Chronic Conditions' },
];

/**
 * Shows target vs. source field-by-field before committing a merge.
 * Rows where the two records disagree (and both have a value) are
 * flagged in warning color — that's the "target wins, source is
 * discarded" case worth double-checking. Rows where only the source has
 * a value are flagged in success color — that's data the merge will
 * actually add to the target.
 *
 * @param {object} props
 * @param {object} props.target - full patient record
 * @param {object} props.source - full patient record
 * @param {() => void} props.onClose
 * @param {() => Promise<void>} props.onConfirm
 */
export function MergeComparisonModal({ target, source, onClose, onConfirm }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(null);

  async function handleConfirm() {
    setConfirming(true);
    setError(null);
    try {
      await onConfirm();
    } catch (e) {
      setError(e.message);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Review Merge" icon="merge_type">
      <Alert variant="warning">
        {source.folder_number} will be merged into {target.folder_number} and then soft-deleted. This cannot be undone.
      </Alert>
      <Alert variant="error">{error}</Alert>

      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Field</th>
              <th>Keep: {target.folder_number}</th>
              <th>Discard: {source.folder_number}</th>
            </tr>
          </thead>
          <tbody>
            {COMPARE_FIELDS.map(({ key, label, format }) => {
              const t = target[key], s = source[key];
              const tDisplay = t ? (format ? format(t) : t) : '—';
              const sDisplay = s ? (format ? format(s) : s) : '—';
              const conflict = t && s && String(t) !== String(s);
              const fillable = !t && !!s;
              return (
                <tr key={key} style={conflict ? { background: 'var(--md-warning-container)' } : fillable ? { background: 'var(--md-success-container)' } : undefined}>
                  <td style={{ fontWeight: 600, fontSize: '.78rem' }}>{label}</td>
                  <td style={{ fontSize: '.78rem' }}>{tDisplay}</td>
                  <td style={{ fontSize: '.78rem' }}>{sDisplay}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '12px 0' }}>
        <Chip variant="warning">Conflict — target's value wins</Chip>
        <Chip variant="success">Source fills a gap in target</Chip>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="warning" fullWidth loading={confirming} icon="merge_type" onClick={handleConfirm}>Confirm Merge</Button>
        <Button variant="text" onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}
