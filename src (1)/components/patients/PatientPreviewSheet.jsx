import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { Chip } from '../ui/Chip';
import { Button } from '../ui/Button';
import { titleCase, formatDate } from '../../lib/format';

/**
 * Bottom-sheet-style preview of a patient, triggered by long-press (or
 * right-click on desktop) on a `PatientCard` — a quick glance at the key
 * facts without committing to leaving the list. "View Full Record" is
 * the only way deeper; this is deliberately read-mostly.
 *
 * @param {object} props
 * @param {object} props.patient
 * @param {() => void} props.onClose
 * @param {() => void} props.onViewFull
 * @param {() => void} props.onEdit
 */
export function PatientPreviewSheet({ patient: p, onClose, onViewFull, onEdit }) {
  const firstName = titleCase(p.first_name), lastName = titleCase(p.last_name);
  const idLabel = p.insurance_number ? 'Insurance' : p.national_id_number ? 'National ID' : 'Non-Insured';
  const idValue = p.insurance_number || p.national_id_number || '—';

  function copyId() {
    if (navigator.clipboard) navigator.clipboard.writeText(p.folder_number).catch(() => {});
  }

  return (
    <Modal open onClose={onClose} title={`${firstName} ${lastName}`} icon="person">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <Avatar firstName={firstName} lastName={lastName} size="lg" />
        <div>
          <div className="patient-id">{p.folder_number}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            {p.is_deleted && <Chip variant="error">Deleted</Chip>}
            {!p.insurance_number && !p.national_id_number && <Chip variant="neutral">Non-Insured</Chip>}
          </div>
        </div>
      </div>

      <div className="grid2" style={{ marginBottom: 16 }}>
        <PreviewField label="Age" value={p.age ?? '—'} />
        <PreviewField label="Gender" value={p.gender} />
        <PreviewField label="Phone" value={p.phone_number || '—'} />
        <PreviewField label={idLabel} value={idValue} />
        <PreviewField label="Registered" value={formatDate(p.created_at)} full />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button variant="filled" size="sm" icon="visibility" onClick={onViewFull}>View Full Record</Button>
        <Button variant="tonal" size="sm" icon="edit" onClick={onEdit}>Edit</Button>
        <Button variant="outlined" size="sm" icon="content_copy" onClick={copyId}>Copy ID</Button>
      </div>
    </Modal>
  );
}

function PreviewField({ label, value, full }) {
  return (
    <div style={full ? { gridColumn: '1 / -1' } : undefined}>
      <span className="label">{label}</span>
      <span>{value}</span>
    </div>
  );
}
