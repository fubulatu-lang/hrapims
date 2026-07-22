import { useState } from 'react';
import { TopBar, BackButton, IconButton, Card, Chip, Avatar, Spinner, Alert, EmptyState, Modal, TextField, Select, Button, Menu, useMenu } from '../components/ui';
import { useApiQuery } from '../hooks/useApiQuery';
import { useNavigation } from '../context/NavigationContext';
import { useSession } from '../context/SessionContext';
import { validateUsername } from '../lib/validation';
import { api } from '../lib/api';
import { titleCase, formatDateTime } from '../lib/format';

const ROLE_OPTIONS = [{ value: 'STAFF', label: 'Staff' }, { value: 'ADMIN', label: 'Administrator' }];
const STATUS_OPTIONS = [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }];

export function StaffManagePage() {
  const { can, staff: me } = useSession();
  const { back } = useNavigation();
  const { data, loading, error, refetch } = useApiQuery('/staff');
  const [modal, setModal] = useState(null); // null | 'create' | staffObject (for edit)

  if (!can('manageStaff')) {
    return (<><TopBar title="Staff Management" leading={<BackButton onClick={back} />} /><div className="main-content"><Alert variant="error">You do not have permission to manage staff accounts.</Alert></div></>);
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
        {data?.staff.map((s) => <StaffRow key={s.id} staff={s} isSelf={s.id === me.id} onEdit={() => setModal(s)} onChanged={refetch} />)}
      </div>

      {modal === 'create' && <CreateStaffModal onClose={() => setModal(null)} onCreated={refetch} />}
      {modal && modal !== 'create' && <EditStaffModal staff={modal} onClose={() => setModal(null)} onSaved={refetch} />}
    </>
  );
}

function StaffRow({ staff: s, isSelf, onEdit, onChanged }) {
  const menu = useMenu();
  const locked = s.locked_until && new Date(s.locked_until) > new Date();

  async function resetPassword() {
    if (!confirm(`Generate a new temporary password for ${titleCase(s.first_name)}?`)) return;
    const d = await api.post(`/staff/${s.id}/reset-password`, {});
    alert(`New temporary password: ${d.temporaryPassword}\n\nShare this with them directly — they'll be asked to set their own password on next sign-in.`);
    onChanged();
  }
  async function remove() {
    if (!confirm(`Remove ${titleCase(s.first_name)} ${titleCase(s.last_name)}'s account? This cannot be undone.`)) return;
    try { await api.delete(`/staff/${s.id}`); onChanged(); } catch (e) { alert(e.message); }
  }

  const menuItems = [
    { label: 'Edit details', icon: 'edit', onClick: onEdit },
    { label: 'Reset password', icon: 'lock_reset', onClick: resetPassword },
  ];
  if (!isSelf) menuItems.push({ label: 'Remove account', icon: 'person_remove', danger: true, onClick: remove });

  return (
    <Card variant="elevated" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <Avatar firstName={s.first_name} lastName={s.last_name} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="patient-name">
          {titleCase(s.first_name)} {titleCase(s.last_name)}
          {isSelf && <span style={{ color: 'var(--md-on-surface-variant)', fontWeight: 400 }}> (you)</span>}
        </div>
        <div style={{ fontSize: '.72rem', color: 'var(--md-on-surface-variant)' }}>@{s.username}</div>
        <div className="patient-meta" style={{ marginTop: 4 }}>
          <Chip variant={s.role === 'ADMIN' ? 'primary' : 'neutral'}>{s.role === 'ADMIN' ? 'Administrator' : 'Staff'}</Chip>
          {!s.is_active && <Chip variant="error">Inactive</Chip>}
          {locked && <Chip variant="error" className="pulse">Locked</Chip>}
          {s.must_change_password && <Chip variant="warning">Password reset pending</Chip>}
        </div>
        <div style={{ fontSize: '.7rem', color: 'var(--md-on-surface-variant)', marginTop: 4 }}>
          Last sign-in: {s.last_login_at ? formatDateTime(s.last_login_at) : 'Never'}
        </div>
      </div>
      <IconButton icon="more_vert" label={`Actions for ${titleCase(s.first_name)}`} onClick={menu.openMenu} />
      <Menu anchorEl={menu.anchorEl} onClose={menu.closeMenu} items={menuItems} />
    </Card>
  );
}

function CreateStaffModal({ onClose, onCreated }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('STAFF');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!firstName.trim() || !lastName.trim()) { setError('First and last name are required'); return; }
    const usernameError = validateUsername(username);
    if (usernameError) { setError(usernameError); return; }
    setSaving(true); setError(null);
    try {
      const d = await api.post('/staff', { firstName, lastName, username, role });
      onClose();
      alert(`Account created for ${firstName} ${lastName} (@${username}).\n\nTemporary password: ${d.temporaryPassword}\n\nShare this with them directly.`);
      onCreated();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title="Add Staff Account" icon="person_add">
      <Alert variant="error">{error}</Alert>
      <TextField label="First Name" value={firstName} onChange={setFirstName} />
      <TextField label="Last Name" value={lastName} onChange={setLastName} />
      <TextField label="Username" value={username} onChange={setUsername} helperText="Letters, numbers, dots, underscores, hyphens" />
      <Select label="Role" value={role} onChange={setRole} options={ROLE_OPTIONS} />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <Button fullWidth loading={saving} onClick={submit}>Create Account</Button>
        <Button variant="text" onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}

const PERMISSION_LABELS = {
  mergePatients: 'Merge Patients',
  restorePatients: 'Restore Deleted Patients',
  hardDeletePatients: 'Permanently Delete Patients',
  manageStaff: 'Manage Staff Accounts',
  editFieldConfig: 'Edit Patient Field Settings',
};

function permStateFromList(list, key) {
  if (!Array.isArray(list)) return 'default';
  if (list.includes(key)) return 'allow';
  if (list.includes(`no:${key}`)) return 'deny';
  return 'default';
}

function EditStaffModal({ staff, onClose, onSaved }) {
  const [firstName, setFirstName] = useState(titleCase(staff.first_name));
  const [lastName, setLastName] = useState(titleCase(staff.last_name));
  const [username, setUsername] = useState(staff.username || '');
  const [role, setRole] = useState(staff.role);
  const [isActive, setIsActive] = useState(String(staff.is_active));
  const [permOverrides, setPermOverrides] = useState(() => {
    const init = {};
    Object.keys(PERMISSION_LABELS).forEach((k) => { init[k] = permStateFromList(staff.permissions, k); });
    return init;
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  function setPerm(key, state) {
    setPermOverrides((o) => ({ ...o, [key]: state }));
  }

  async function submit() {
    const usernameError = validateUsername(username);
    if (usernameError) { setError(usernameError); return; }
    setSaving(true); setError(null);
    const permissions = Object.entries(permOverrides).flatMap(([key, state]) =>
      state === 'allow' ? [key] : state === 'deny' ? [`no:${key}`] : []
    );
    try {
      await api.put(`/staff/${staff.id}`, { firstName, lastName, username, role, isActive: isActive === 'true', permissions });
      onClose(); onSaved();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title="Edit Staff" icon="edit">
      <Alert variant="error">{error}</Alert>
      <TextField label="First Name" value={firstName} onChange={setFirstName} />
      <TextField label="Last Name" value={lastName} onChange={setLastName} />
      <TextField label="Username" value={username} onChange={setUsername} />
      <Select label="Role" value={role} onChange={setRole} options={ROLE_OPTIONS} />
      <Select label="Status" value={isActive} onChange={setIsActive} options={STATUS_OPTIONS} />

      <div style={{ marginTop: 10, marginBottom: 6 }}>
        <div className="label">Permission Overrides</div>
        <p style={{ fontSize: '.72rem', color: 'var(--md-on-surface-variant)', marginTop: -2, marginBottom: 8 }}>
          "Default" follows their role's normal access. Only change these to grant or remove a specific capability for this person.
        </p>
      </div>
      {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', flexWrap: 'wrap' }}>
          <span style={{ flex: 1, fontSize: '.8rem', minWidth: 140 }}>{label}</span>
          {['default', 'allow', 'deny'].map((state) => (
            <Button
              key={state}
              size="xs"
              variant={permOverrides[key] === state ? 'tonal' : 'outlined'}
              onClick={() => setPerm(key, state)}
            >
              {state === 'default' ? 'Default' : state === 'allow' ? 'Allow' : 'Deny'}
            </Button>
          ))}
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <Button fullWidth loading={saving} onClick={submit}>Save Changes</Button>
        <Button variant="text" onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}
