import { useState } from 'react';
import { TopBar, BackButton, IconButton, Card, Chip, Avatar, Spinner, Alert, EmptyState, Modal, TextField, Select, Button, Menu, useMenu } from '../components/ui';
import { useApiQuery } from '../hooks/useApiQuery';
import { useNavigation } from '../context/NavigationContext';
import { useSession } from '../context/SessionContext';
import { api } from '../lib/api';
import { titleCase, formatDateTime } from '../lib/format';

const ROLE_OPTIONS = [{ value: 'STAFF', label: 'Staff' }, { value: 'ADMIN', label: 'Administrator' }];
const STATUS_OPTIONS = [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }];

export function StaffManagePage() {
  const { isAdmin } = useSession();
  const { back } = useNavigation();
  const { data, loading, error, refetch } = useApiQuery('/staff');
  const [modal, setModal] = useState(null); // null | 'create' | staffObject (for edit)

  if (!isAdmin) {
    return (<><TopBar title="Staff Management" leading={<BackButton onClick={back} />} /><div className="main-content"><Alert variant="error">Administrator access required</Alert></div></>);
  }

  return (
    <>
      <TopBar
        title="Staff Management"
        subtitle={data ? `${data.staff.length} accounts` : undefined}
        leading={<BackButton onClick={back} />}
        trailing={<IconButton icon="person_add" label="Add staff account" variant="tonal" onClick={() => setModal('create')} />}
      />
      <div className="main-content">
        {loading && <Spinner label="Loading staff" />}
        {error && <Alert variant="error">{error}</Alert>}
        {data && data.staff.length === 0 && <EmptyState icon="group_off" title="No staff accounts yet" />}
        {data?.staff.map((s) => <StaffRow key={s.id} staff={s} onEdit={() => setModal(s)} onChanged={refetch} />)}
      </div>

      {modal === 'create' && <CreateStaffModal onClose={() => setModal(null)} onCreated={refetch} />}
      {modal && modal !== 'create' && <EditStaffModal staff={modal} onClose={() => setModal(null)} onSaved={refetch} />}
    </>
  );
}

function StaffRow({ staff: s, onEdit, onChanged }) {
  const menu = useMenu();
  const locked = s.locked_until && new Date(s.locked_until) > new Date();

  async function resetPin() {
    if (!confirm('Generate a new temporary PIN for this account?')) return;
    const d = await api.post(`/staff/${s.id}/reset-pin`, {});
    alert(`New temporary PIN: ${d.temporaryPin}\n\nShare this with them directly — they'll set their own PIN once real sign-in is enabled.`);
    onChanged();
  }
  async function remove() {
    if (!confirm(`Remove ${titleCase(s.first_name)} ${titleCase(s.last_name)}'s account? This cannot be undone.`)) return;
    try { await api.delete(`/staff/${s.id}`); onChanged(); } catch (e) { alert(e.message); }
  }

  return (
    <Card variant="elevated" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <Avatar firstName={s.first_name} lastName={s.last_name} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="patient-name">{titleCase(s.first_name)} {titleCase(s.last_name)}</div>
        <div className="patient-meta" style={{ marginTop: 4 }}>
          <Chip variant={s.role === 'ADMIN' ? 'primary' : 'neutral'}>{s.role === 'ADMIN' ? 'Administrator' : 'Staff'}</Chip>
          {!s.is_active && <Chip variant="error">Inactive</Chip>}
          {locked && <Chip variant="error" className="pulse">Locked</Chip>}
          {s.must_change_pin && <Chip variant="warning">PIN reset pending</Chip>}
        </div>
        <div style={{ fontSize: '.7rem', color: 'var(--md-on-surface-variant)', marginTop: 4 }}>
          Last sign-in: {s.last_login_at ? formatDateTime(s.last_login_at) : 'Never'}
        </div>
      </div>
      <IconButton icon="more_vert" label={`Actions for ${titleCase(s.first_name)}`} onClick={menu.openMenu} />
      <Menu
        anchorEl={menu.anchorEl}
        onClose={menu.closeMenu}
        items={[
          { label: 'Edit details', icon: 'edit', onClick: onEdit },
          { label: 'Reset PIN', icon: 'lock_reset', onClick: resetPin },
          { label: 'Remove account', icon: 'person_remove', danger: true, onClick: remove },
        ]}
      />
    </Card>
  );
}

function CreateStaffModal({ onClose, onCreated }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('STAFF');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!firstName.trim() || !lastName.trim()) { setError('First and last name are required'); return; }
    setSaving(true); setError(null);
    try {
      const d = await api.post('/staff', { firstName, lastName, role });
      onClose();
      alert(`Account created for ${firstName} ${lastName}.\n\nTemporary PIN: ${d.temporaryPin}\n\nShare this PIN with them directly.`);
      onCreated();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title="Add Staff Account" icon="person_add">
      <Alert variant="error">{error}</Alert>
      <TextField label="First Name" value={firstName} onChange={setFirstName} />
      <TextField label="Last Name" value={lastName} onChange={setLastName} />
      <Select label="Role" value={role} onChange={setRole} options={ROLE_OPTIONS} />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <Button fullWidth loading={saving} onClick={submit}>Create Account</Button>
        <Button variant="text" onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}

function EditStaffModal({ staff, onClose, onSaved }) {
  const [firstName, setFirstName] = useState(titleCase(staff.first_name));
  const [lastName, setLastName] = useState(titleCase(staff.last_name));
  const [role, setRole] = useState(staff.role);
  const [isActive, setIsActive] = useState(String(staff.is_active));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true); setError(null);
    try {
      await api.put(`/staff/${staff.id}`, { firstName, lastName, role, isActive: isActive === 'true' });
      onClose(); onSaved();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title="Edit Staff" icon="edit">
      <Alert variant="error">{error}</Alert>
      <TextField label="First Name" value={firstName} onChange={setFirstName} />
      <TextField label="Last Name" value={lastName} onChange={setLastName} />
      <Select label="Role" value={role} onChange={setRole} options={ROLE_OPTIONS} />
      <Select label="Status" value={isActive} onChange={setIsActive} options={STATUS_OPTIONS} />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <Button fullWidth loading={saving} onClick={submit}>Save Changes</Button>
        <Button variant="text" onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}
