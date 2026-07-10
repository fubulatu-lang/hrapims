import { TopBar, BackButton, IconButton, Card, Chip, Avatar, Spinner, Alert, Menu, useMenu } from '../components/ui';
import { useApiQuery } from '../hooks/useApiQuery';
import { useNavigation } from '../context/NavigationContext';
import { useSession } from '../context/SessionContext';
import { api } from '../lib/api';
import { titleCase, formatDate } from '../lib/format';

export function PatientDetailPage() {
  const { params, navigate, back } = useNavigation();
  const { isAdmin } = useSession();
  const menu = useMenu();
  const { data: p, loading, error, refetch } = useApiQuery(`/patients/${params.folderNumber}`);

  if (loading) return (<><TopBar title="Patient Record" leading={<BackButton onClick={back} />} /><Spinner label="Loading patient" /></>);
  if (error) return (<><TopBar title="Patient Record" leading={<BackButton onClick={back} />} /><div className="main-content"><Alert variant="error">{error}</Alert></div></>);

  const firstName = titleCase(p.first_name), lastName = titleCase(p.last_name);
  const idLabel = p.insurance_number ? 'Insurance' : p.national_id_number ? 'National ID' : 'Non-Insured';
  const idValue = p.insurance_number || p.national_id_number || '—';

  async function handleSoftDelete() {
    if (!confirm('Soft delete this patient? It can be restored later.')) return;
    await api.delete(`/patients/${p.folder_number}`);
    navigate('patientList');
  }
  async function handleRestore() {
    await api.post(`/patients/${p.folder_number}/restore`, {});
    refetch();
  }
  async function handleHardDelete() {
    if (!confirm('PERMANENTLY delete this patient? This cannot be undone.')) return;
    const typed = prompt('Type DELETE to confirm permanent deletion:');
    if (typed !== 'DELETE') return;
    await api.delete(`/patients/${p.folder_number}/permanent`, { confirmation: 'DELETE' });
    navigate('patientList');
  }

  const menuItems = !p.is_deleted
    ? [
        { label: 'Edit record', icon: 'edit', onClick: () => navigate('patientForm', { folderNumber: p.folder_number }) },
        { label: 'Delete record', icon: 'delete', danger: true, onClick: handleSoftDelete },
      ]
    : isAdmin
    ? [
        { label: 'Restore record', icon: 'restore_page', onClick: handleRestore },
        { label: 'Delete forever', icon: 'delete_forever', danger: true, onClick: handleHardDelete },
      ]
    : [];

  return (
    <>
      <TopBar
        title={p.folder_number}
        subtitle={`Version ${p.version}`}
        leading={<BackButton onClick={back} />}
        trailing={menuItems.length > 0 && <IconButton icon="more_vert" label="More actions" onClick={menu.openMenu} />}
      />
      <Menu anchorEl={menu.anchorEl} onClose={menu.closeMenu} items={menuItems} />

      <div className="main-content">
        <Card variant="elevated" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Avatar firstName={firstName} lastName={lastName} size="lg" />
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{firstName} {lastName}</h2>
            <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {p.is_deleted && <Chip variant="error" icon="delete">Soft Deleted</Chip>}
              {!p.insurance_number && !p.national_id_number && <Chip variant="neutral">Non-Insured</Chip>}
            </div>
          </div>
        </Card>

        {p.is_deleted && !isAdmin && (
          <Alert variant="info">Deleted records can only be restored by an administrator.</Alert>
        )}

        <div className="section-header">Personal Information</div>
        <Card>
          <div className="grid2">
            <Field label="Date of Birth" value={p.date_of_birth ? `${formatDate(p.date_of_birth)}${p.is_age_estimated ? ' (Est.)' : ''}` : '—'} />
            <Field label="Age" value={p.age ?? '—'} />
            <Field label="Gender" value={p.gender} />
            <Field label="Phone" value={p.phone_number || '—'} />
            <Field label="Location" value={p.location} full />
          </div>
        </Card>

        <div className="section-header">Identification</div>
        <Card><div className="grid2"><Field label={idLabel} value={idValue} /></div></Card>

        {(p.height || p.weight) && (
          <>
            <div className="section-header">Physical Metrics</div>
            <Card>
              <div className="grid3">
                <Field label="Height" value={p.height ? `${p.height} cm` : '—'} />
                <Field label="Weight" value={p.weight ? `${p.weight} kg` : '—'} />
                <Field label="BMI" value={p.bmi ? `${p.bmi} (${p.bmi_category})` : '—'} />
              </div>
            </Card>
          </>
        )}

        <div className="section-header">Next of Kin</div>
        <Card>
          <div className="grid2">
            <Field label="Name" value={p.next_of_kin_name ? titleCase(p.next_of_kin_name) : '—'} />
            <Field label="Contact" value={p.next_of_kin_contact || '—'} />
          </div>
        </Card>

        <div className="section-header">Medical</div>
        <Card>
          <div className="grid2">
            <Field label="Allergies" value={p.allergies || 'None recorded'} />
            <Field label="Conditions" value={p.chronic_conditions || 'None recorded'} />
          </div>
        </Card>
      </div>
    </>
  );
}

function Field({ label, value, full }) {
  return (
    <div style={full ? { gridColumn: '1 / -1' } : undefined}>
      <span className="label">{label}</span>
      <span>{value}</span>
    </div>
  );
}
