import { useEffect, useState } from 'react';
import { TopBar, Card, CardTitle, Avatar, Chip, Button, TextField, Alert } from '../components/ui';
import { useSession } from '../context/SessionContext';
import { useNavigation } from '../context/NavigationContext';
import { useTheme, THEMES } from '../hooks/useTheme';
import { HAPTIC_LEVELS, getHapticLevel, setHapticLevel, triggerHaptic } from '../lib/haptics';
import { SOUND_LEVELS, getSoundLevel, setSoundLevel, playTouchSound } from '../lib/touchSound';
import { api } from '../lib/api';

const APP_VERSION = '2.2.0';

export function SettingsPage() {
  const { role, isAdmin, logout } = useSession();
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
          <Avatar firstName={isAdmin ? 'A' : 'S'} lastName="" />
          <div style={{ flex: 1 }}>
            <div className="patient-name">{isAdmin ? 'Administrator' : 'Staff'} session</div>
            <Chip variant={isAdmin ? 'primary' : 'neutral'}>{role}</Chip>
          </div>
          <Button variant="outlined" size="sm" icon="logout" onClick={handleSignOut}>Sign Out</Button>
        </Card>

        {isAdmin && (
          <>
            <div className="section-header">Staff Accounts</div>
            <Card>
              <CardTitle icon="groups">Manage Staff</CardTitle>
              <p style={{ fontSize: '.8rem', color: 'var(--md-on-surface-variant)', marginBottom: 12 }}>
                Add staff and administrator accounts, reset PINs, or deactivate access.
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
            <Button variant="tonal" size="sm" icon="description" onClick={() => window.open(api.fileUrl('/export/patients'), '_blank')}>
              Patients CSV
            </Button>
            <Button variant="outlined" size="sm" icon="description" onClick={() => window.open(api.fileUrl('/export/activity'), '_blank')}>
              Activity CSV
            </Button>
          </div>
        </Card>

        <div className="section-header">Backup &amp; Maintenance</div>
        <BackupCard />
        <MergeCard />
        {isAdmin && <FolderFormatCard />}

        <div className="section-header">Appearance</div>
        <ThemeCard />

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
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function run() {
    setError(null); setResult(null);
    if (!target || !source) return setError('Enter both folder numbers');
    if (target === source) return setError('Cannot merge a record into itself');
    if (!confirm(`Merge ${source} into ${target}? Source will be soft-deleted. This cannot be undone.`)) return;
    try {
      const d = await api.post('/patients/merge', { targetFolderNumber: target, sourceFolderNumber: source, confirmation: 'MERGE' });
      setResult(d.conflicts ? `Merged. Conflicts (target kept): ${Object.keys(d.conflicts).join(', ')}` : 'Patients merged.');
    } catch (e) { setError(e.message); }
  }

  return (
    <Card>
      <CardTitle icon="merge_type">Merge Patients</CardTitle>
      <div className="row">
        <TextField label="Target Folder # (keep)" value={target} onChange={setTarget} />
        <TextField label="Source Folder # (delete)" value={source} onChange={setSource} />
      </div>
      <Button variant="warning" size="sm" icon="merge_type" onClick={run}>Merge Patients</Button>
      {result && <Alert variant="success">{result}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}
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
