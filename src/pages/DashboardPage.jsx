import { TopBar, IconButton, Card, CardTitle, Icon, Chip, Button, Spinner, Alert, EmptyState } from '../components/ui';
import { useApiQuery } from '../hooks/useApiQuery';
import { useSession } from '../context/SessionContext';
import { useNavigation } from '../context/NavigationContext';
import { useDarkMode } from '../hooks/useDarkMode';
import { titleCase } from '../lib/format';

export function DashboardPage() {
  const { staffLabel, role } = useDisplaySession();
  const { goTo } = useNavigation();
  const [dark, setDark] = useDarkMode();

  const totals = useApiQuery('/patients?limit=1');
  const recent = useApiQuery('/activity?limit=5');

  return (
    <>
      <TopBar
        title="HRAPIMS"
        subtitle={`Signed in as ${staffLabel}`}
        trailing={
          <IconButton icon={dark ? 'light_mode' : 'dark_mode'} label="Toggle dark mode" onClick={() => setDark((d) => !d)} />
        }
      />
      <div className="main-content">
        <div className="grid2" style={{ marginBottom: 12, gap: 12 }}>
          <Card variant="elevated" className="stat-card">
            <div className="stat-value">{totals.loading ? '—' : totals.data?.pagination?.total ?? 0}</div>
            <div className="stat-label">Total Patients</div>
          </Card>
          <Card variant="elevated" className="stat-card">
            <Icon name="local_hospital" className="stat-value" />
            <div className="stat-label">Hospital Records</div>
          </Card>
        </div>

        <Card variant="elevated">
          <CardTitle icon="bolt">Quick Actions</CardTitle>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="tonal" size="sm" icon="person_add" onClick={() => goTo('patientForm')}>New Patient</Button>
            <Button variant="tonal" size="sm" icon="history" onClick={() => goTo('activity')}>View Logs</Button>
            {role === 'ADMIN' && (
              <Button variant="tonal" size="sm" icon="groups" onClick={() => goTo('staffManage')}>Manage Staff</Button>
            )}
            <Button variant="tonal" size="sm" icon="settings" onClick={() => goTo('settings')}>Settings</Button>
          </div>
        </Card>

        <Card variant="elevated">
          <CardTitle icon="history">Recent Activity</CardTitle>
          {recent.loading && <Spinner label="Loading recent activity" />}
          {recent.error && <Alert variant="error">{recent.error}</Alert>}
          {!recent.loading && !recent.error && (!recent.data?.logs || recent.data.logs.length === 0) && (
            <EmptyState icon="inbox" title="No recent activity" />
          )}
          {recent.data?.logs?.map((l) => (
            <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--md-outline-variant)', fontSize: '.8rem' }}>
              <Chip variant={l.action.includes('DELETE') ? 'error' : l.action.includes('CREATE') ? 'success' : 'primary'}>{l.action}</Chip>
              <span style={{ color: 'var(--md-on-surface-variant)' }}>{l.entity_type}</span>
              <span style={{ color: 'var(--md-on-surface-variant)', marginLeft: 'auto', fontSize: '.72rem' }}>
                {new Date(l.created_at).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}

/** Small local helper so the JSX above stays readable. */
function useDisplaySession() {
  const { role } = useSession();
  // The pseudo-login has no staff name yet — once real auth lands this
  // reads session.staff.firstName instead of the role placeholder.
  const staffLabel = titleCase(role === 'ADMIN' ? 'Administrator' : 'Staff');
  return { staffLabel, role };
}
