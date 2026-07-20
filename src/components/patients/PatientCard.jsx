import { Avatar } from '../ui/Avatar';
import { Chip } from '../ui/Chip';
import { Icon } from '../ui/Icon';
import { useLongPress } from '../../hooks/useLongPress';
import { titleCase, formatDate } from '../../lib/format';

/**
 * A single patient row used in both the Patients list and Search results,
 * so the two screens can never visually drift apart.
 *
 * @param {object} props
 * @param {object} props.patient - raw patient record from the API
 * @param {() => void} props.onClick
 * @param {() => void} [props.onPreview] - long-press / right-click, shows a quick-glance sheet instead of navigating
 */
export function PatientCard({ patient: p, onClick, onPreview }) {
  const firstName = titleCase(p.first_name);
  const lastName = titleCase(p.last_name);
  const idLabel = p.insurance_number ? 'Ins' : p.national_id_number ? 'NatID' : 'Non-Insured';
  const idValue = p.insurance_number || p.national_id_number || '—';
  const longPress = useLongPress(() => onPreview?.(), { threshold: 450 });

  return (
    <button className="card elevated patient-card" onClick={onClick} {...(onPreview ? longPress : {})}>
      <Avatar firstName={firstName} lastName={lastName} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
          <span className="patient-id">{p.folder_number}</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {p.is_deleted && <Chip variant="error">Deleted</Chip>}
            {!p.insurance_number && !p.national_id_number && <Chip variant="neutral">Non-Insured</Chip>}
          </div>
        </div>
        <div className="patient-name">{firstName} {lastName}</div>
        <div className="patient-meta">
          <span>{p.age ?? '—'} yrs</span>
          <span>{p.gender}</span>
          <span>{idLabel}: {idValue}</span>
          {p.phone_number && <span><Icon name="call" /> {p.phone_number}</span>}
          <span><Icon name="event" /> {formatDate(p.created_at)}</span>
        </div>
      </div>
    </button>
  );
}
