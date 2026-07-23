import { useEffect, useState } from 'react';
import { TopBar, Card, CardTitle, Avatar, Chip, Button, TextField, Alert } from '../components/ui';
import { useSession } from '../context/SessionContext';
import { useNavigation } from '../context/NavigationContext';
import { useTheme, THEMES } from '../hooks/useTheme';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { HAPTIC_LEVELS, getHapticLevel, setHapticLevel, triggerHaptic } from '../lib/haptics';
import { SOUND_LEVELS, getSoundLevel, setSoundLevel, playTouchSound } from '../lib/touchSound';
import { validatePassword } from '../lib/validation';
import { MergeComparisonModal } from '../components/patients/MergeComparisonModal';
import { api } from '../lib/api';
import { titleCase } from '../lib/format';

const APP_VERSION = '2.5.0';

export function SettingsPage() {
  const { staff, role, isAdmin, can, logout } = useSession();
  const { navigate } = useNavigation();

  function handleSignOut() {
    if (confirm('Sign out of HRAPIMS?')) logout();
  }

  return (
    <>
      <TopBar title="Settings" />
      <div className="main-content">
        <div className="section-header">Account</div>
        <Card variant="elevated" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Avatar firstName={staff.firstName} lastName={staff.lastName} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="patient-name">{titleCase(staff.firstName)} {titleCase(staff.lastName)}</div>
            <div style={{ fontSize: '.72rem', color: 'var(--md-on-surface-variant)', marginTop: 2 }}>
              @{staff.username} · ID {staff.id.slice(0, 8)}
            </div>
            <div style={{ marginTop: 6 }}><Chip variant={isAdmin ? 'primary' : 'neutral'}>{role}</Chip></div>
          </div>
          <Button variant="outlined" size="sm" icon="logout" onClick={handleSignOut}>Sign Out</Button>
        </Card>
        <ChangePasswordCard />

        {can('manageStaff') && (
          <>
            <div className="section-header">Staff Accounts</div>
            <Card>
              <CardTitle icon="groups">Manage Staff</CardTitle>
              <p style={{ fontSize: '.8rem', color: 'var(--md-on-surface-variant)', marginBottom: 12 }}>
                Add staff and administrator accounts, reset passwords, or deactivate access.
              </p>
              <Button variant="tonal" size="sm" icon="manage_accounts" onClick={() => navigate('staffManage')}>
                Open Staff Management
              </Button>
            </Card>
          </>
        )}

        <div className="section-header">Data Export</div>
        <Card>
          <CardTitle icon="download">Export Data</CardTitle>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="tonal" size="sm" icon="description" onClick={() => api.download('/export/patients', 'hrapims-patients.csv')}>
              Patients CSV
            </Button>
            <Button variant="outlined" size="sm" icon="description" onClick={() => api.download('/export/activity', 'hrapims-activity.csv')}>
              Activity CSV
            </Button>
          </div>
        </Card>

        <div className="section-header">Backup &amp; Maintenance</div>
        <BackupCard />
        {can('mergePatients') && <MergeCard />}
        {isAdmin && <FolderFormatCard />}

        {can('editFieldConfig') && (
          <>
            <div className="section-header">Patient Registration Fields</div>
            <PatientFieldsCard />
          </>
        )}

        <div className="section-header">Appearance</div>
        <ThemeCard />
        <InstallAppCard />

        <div className="section-header">Feedback</div>
        <HapticsCard />
        <SoundCard />

        <p style={{ textAlign: 'center', fontSize: '.7rem', color: 'var(--md-on-surface-variant)', marginTop: 24 }}>
          HRAPIMS v{APP_VERSION}
        </p>
      </div>
    </>
  );
}

function InstallAppCard() {
  const { canInstall, promptInstall } = useInstallPrompt();
  const isStandalone = typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches;
  const isIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

  if (isStandalone) return null; // already installed — nothing to offer

  return (
    <Card>
      <CardTitle icon="install_mobile">Install App</CardTitle>
      {canInstall && (
        <>
          <p style={{ fontSize: '.8rem', color: 'var(--md-on-surface-variant)', marginBottom: 10 }}>
            Install HRAPIMS for quicker access and an app-like experience, even with a flaky connection.
          </p>
          <Button variant="tonal" size="sm" icon="download" onClick={promptInstall}>Install</Button>
        </>
      )}
      {!canInstall && isIOS && (
        <p style={{ fontSize: '.8rem', color: 'var(--md-on-surface-variant)' }}>
          On iPhone/iPad: tap the Share icon in Safari, then "Add to Home Screen."
        </p>
      )}
      {!canInstall && !isIOS && (
        <p style={{ fontSize: '.8rem', color: 'var(--md-on-surface-variant)' }}>
          Your browser will offer an install option (often in the address bar) once available.
        </p>
      )}
    </Card>
  );
}

function ThemeCard() {
  const [theme, setTheme] = useTheme();
  return (
    <Card>
      <CardTitle icon="palette">Theme</CardTitle>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {THEMES.map((t) => (
          <Button key={t.value} variant={theme === t.value ? 'filled' : 'tonal'} size="sm" icon={t.icon} onClick={() => setTheme(t.value)}>
            {t.label}
          </Button>
        ))}
      </div>
      {theme === 'midnight' && (
        <p style={{ fontSize: '.72rem', color: 'var(--md-on-surface-variant)', marginTop: 10 }}>
          True black backgrounds — easier on the eyes and battery on OLED/AMOLED screens.
        </p>
      )}
    </Card>
  );
}

function HapticsCard() {
  const [level, setLevel] = useState(getHapticLevel());
  function choose(v) { setHapticLevel(v); setLevel(v); triggerHaptic(); }
  return (
    <Card>
      <CardTitle icon="vibration">Haptics</CardTitle>
      <p style={{ fontSize: '.78rem', color: 'var(--md-on-surface-variant)', marginBottom: 10 }}>
        Vibration strength when tapping buttons and navigation.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {HAPTIC_LEVELS.map((h) => (
          <Button key={h.value} variant={level === h.value ? 'filled' : 'tonal'} size="sm" onClick={() => choose(h.value)}>
            {h.label}
          </Button>
        ))}
      </div>
    </Card>
  );
}

function SoundCard() {
  const [level, setLevel] = useState(getSoundLevel());
  function choose(v) { setSoundLevel(v); setLevel(v); playTouchSound(); }
  return (
    <Card>
      <CardTitle icon="volume_up">Touch Sounds</CardTitle>
      <p style={{ fontSize: '.78rem', color: 'var(--md-on-surface-variant)', marginBottom: 10 }}>
        Volume of the tap sound when using the app.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {SOUND_LEVELS.map((s) => (
          <Button key={s.value} variant={level === s.value ? 'filled' : 'tonal'} size="sm" onClick={() => choose(s.value)}>
            {s.label}
          </Button>
        ))}
      </div>
    </Card>
  );
}

function BackupCard() {
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  async function run() {
    setError(null);
    try { const d = await api.post('/export/backup', {}); setResult(`Backup ready: ${d.recordCount} records`); }
    catch (e) { setError(e.message); }
  }
  return (
    <Card>
      <CardTitle icon="backup">Backup</CardTitle>
      <Button variant="tonal" size="sm" onClick={run}>Create Backup Now</Button>
      {result && <Alert variant="success">{result}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}
    </Card>
  );
}

function MergeCard() {
  const [target, setTarget] = useState('');
  const [source, setSource] = useState('');
  const [comparing, setComparing] = useState(false);
  const [pair, setPair] = useState(null); // { target: patient, source: patient }
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function lookUp() {
    setError(null); setResult(null);
    if (!target || !source) return setError('Enter both folder numbers');
    if (target === source) return setError('Cannot merge a record into itself');
    setComparing(true);
    try {
      const [targetPatient, sourcePatient] = await Promise.all([
        api.get(`/patients/${target}`),
        api.get(`/patients/${source}`),
      ]);
      setPair({ target: targetPatient, source: sourcePatient });
    } catch (e) {
      setError(e.message);
    } finally {
      setComparing(false);
    }
  }

  async function confirmMerge() {
    const d = await api.post('/patients/merge', { targetFolderNumber: target, sourceFolderNumber: source, confirmation: 'MERGE' });
    setPair(null);
    setResult(d.conflicts ? `Merged. Conflicts (target kept): ${Object.keys(d.conflicts).join(', ')}` : 'Patients merged.');
  }

  return (
    <Card>
      <CardTitle icon="merge_type">Merge Patients</CardTitle>
      <p style={{ fontSize: '.8rem', color: 'var(--md-on-surface-variant)', marginBottom: 10 }}>
        Look up both records first and review a side-by-side comparison before anything is merged.
      </p>
      <div className="row">
        <TextField label="Target Folder # (keep)" value={target} onChange={setTarget} />
        <TextField label="Source Folder # (delete)" value={source} onChange={setSource} />
      </div>
      <Button variant="tonal" size="sm" icon="search" loading={comparing} onClick={lookUp}>Look Up &amp; Compare</Button>
      {result && <Alert variant="success">{result}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      {pair && (
        <MergeComparisonModal
          target={pair.target}
          source={pair.source}
          onClose={() => setPair(null)}
          onConfirm={confirmMerge}
        />
      )}
    </Card>
  );
}

function FolderFormatCard() {
  const [format, setFormat] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    api.get('/settings/folder-format').then((s) => setFormat(s.folder_number_format)).catch(() => setFormat(''));
  }, []);

  async function save() {
    try { await api.put('/settings/folder-format', { folderNumberFormat: format }); setMessage({ type: 'success', text: 'Saved' }); }
    catch (e) { setMessage({ type: 'error', text: e.message }); }
  }

  return (
    <Card>
      <CardTitle icon="tag">Folder Numbering</CardTitle>
      {format === null ? (
        <div className="spinner" />
      ) : (
        <>
          <TextField
            label="Format"
            value={format}
            onChange={setFormat}
            helperText="Use YYYY / MM / XXXXX placeholders, e.g. F-YYYY-XXXXX"
          />
          <Button variant="tonal" size="sm" onClick={save}>Save</Button>
          {message && <Alert variant={message.type}>{message.text}</Alert>}
        </>
      )}
    </Card>
  );
}

function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError(null);
    setSuccess(null);
    if (!currentPassword) { setError('Enter your current password'); return; }
    const policyError = validatePassword(newPassword);
    if (policyError) { setError(policyError); return; }
    if (newPassword !== confirmPassword) { setError('New passwords do not match'); return; }
    setSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setSuccess('Password updated');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardTitle icon="password">Change Password</CardTitle>
      <TextField label="Current Password" type="password" autoComplete="current-password" value={currentPassword} onChange={setCurrentPassword} />
      <TextField label="New Password" type="password" autoComplete="new-password" value={newPassword} onChange={setNewPassword}
        helperText="At least 8 characters, with a letter and a number" />
      <TextField label="Confirm New Password" type="password" autoComplete="new-password" value={confirmPassword} onChange={setConfirmPassword} />
      <Button variant="tonal" size="sm" loading={saving} onClick={submit}>Update Password</Button>
      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}
    </Card>
  );
}

function PatientFieldsCard() {
  const [fields, setFields] = useState(null);
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/settings/patient-fields').then((d) => setFields(d.fields)).catch(() => setFields([]));
  }, []);

  function toggle(key, patch) {
    setFields((list) => list.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  }

  async function save() {
    setSaving(true); setMessage(null);
    try {
      const d = await api.put('/settings/patient-fields', { fields });
      setFields(d.fields);
      setMessage({ type: 'success', text: 'Saved' });
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  }

  if (fields === null) {
    return <Card><div className="spinner" /></Card>;
  }

  const bySection = fields.reduce((acc, f) => {
    (acc[f.section] = acc[f.section] || []).push(f);
    return acc;
  }, {});

  return (
    <Card>
      <CardTitle icon="tune">Patient Registration Fields</CardTitle>
      <p style={{ fontSize: '.8rem', color: 'var(--md-on-surface-variant)', marginBottom: 14 }}>
        Choose which optional fields appear on the New Patient form, and which of those must be filled in.
        First Name, Last Name, Gender, and Location always show and are always required.
      </p>
      {Object.entries(bySection).map(([section, sectionFields]) => (
        <div key={section} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--md-on-surface-variant)', marginBottom: 8 }}>
            {section}
          </div>
          {sectionFields.map((f) => (
            <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--md-outline-variant)', flexWrap: 'wrap' }}>
              <span style={{ flex: 1, fontSize: '.85rem', minWidth: 140 }}>{f.label}</span>
              <Button variant={f.enabled ? 'tonal' : 'outlined'} size="xs" icon={f.enabled ? 'visibility' : 'visibility_off'}
                onClick={() => toggle(f.key, f.enabled ? { enabled: false, required: false } : { enabled: true })}>
                {f.enabled ? 'Shown' : 'Hidden'}
              </Button>
              <Button variant={f.required ? 'tonal' : 'outlined'} size="xs" icon={f.required ? 'star' : 'star_outline'}
                disabled={!f.enabled} onClick={() => toggle(f.key, { required: !f.required })}>
                {f.required ? 'Required' : 'Optional'}
              </Button>
            </div>
          ))}
        </div>
      ))}
      <Button variant="filled" size="sm" loading={saving} onClick={save}>Save Field Settings</Button>
      {message && <Alert variant={message.type}>{message.text}</Alert>}
    </Card>
  );
}
