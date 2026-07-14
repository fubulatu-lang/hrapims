import { TopBar, Card, CardTitle, Icon, Chip, Avatar, Button, Spinner, Alert, EmptyState } from '../components/ui';
import { useApiQuery } from '../hooks/useApiQuery';
import { useSession } from '../context/SessionContext';
import { useNavigation } from '../context/NavigationContext';
import { titleCase } from '../lib/format';

const APP_VERSION = '2.2.0';

export function DashboardPage() {
  const { staffLabel, role, isAdmin } = useDisplaySession();
  const { goTo, navigate } = useNavigation();

  const stats = useApiQuery('/patients/stats');
  // Staff don't have access to activity logs — skip the request entirely
  // rather than fetch-then-hide, so there's no stray network call either.
  const recent = useApiQuery(isAdmin ? '/activity?limit=5' : null);

  return (
    <>
      <TopBar
        leading={<div className="hero-logo"><Icon name="local_hospital" /></div>}
        title={`HRAPIMS v${APP_VERSION}`}
        subtitle="Hospital Records & Patient Information Management"
        trailing={
          <button className="profile-badge" onClick={() => goTo('settings')} aria-label="Open account settings">
            <div style={{ textAlign: 'right' }}>
              <div className="profile-badge-name">{staffLabel}</div>
              <div className="profile-badge-role">
                <Chip variant={isAdmin ? 'primary' : 'neutral'}>{role}</Chip>
              </div>
            </div>
            <Avatar firstName={isAdmin ? 'A' : 'S'} lastName="" />
          </button>
        }
      />
      <div className="main-content">
        <div className="section-header">Overview</div>
        <div className="grid3" style={{ marginBottom: 12, gap: 12 }}>
          <Card variant="elevated" className="stat-card">
            <Icon name="today" className="stat-icon" />
            <div className="stat-value">{stats.loading ? '—' : stats.data?.today ?? 0}</div>
            <div className="stat-label">New Today</div>
          </Card>
          <Card variant="elevated" className="stat-card">
            <Icon name="date_range" className="stat-icon" />
            <div className="stat-value">{stats.loading ? '—' : stats.data?.week ?? 0}</div>
            <div className="stat-label">This Week</div>
          </Card>
          <Card variant="elevated" className="stat-card">
            <Icon name="calendar_month" className="stat-icon" />
            <div className="stat-value">{stats.loading ? '—' : stats.data?.month ?? 0}</div>
            <div className="stat-label">This Month</div>
          </Card>
        </div>
        <Card variant="outlined" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
          <Icon name="groups" style={{ color: 'var(--md-primary)' }} />
          <span style={{ fontSize: '.85rem', color: 'var(--md-on-surface-variant)' }}>Total patients on record</span>
          <strong style={{ marginLeft: 'auto', fontSize: '1.1rem' }}>{stats.loading ? '—' : stats.data?.total ?? 0}</strong>
        </Card>

        <div className="section-header">Quick Actions</div>
        <div className="quick-actions-grid">
          <QuickAction icon="search" label="Search Patients" onClick={() => goTo('search')} />
          <QuickAction icon="person_add" label="Add Patient" onClick={() => navigate('patientForm')} />
          <QuickAction icon="groups" label="Manage Patients" onClick={() => goTo('patientList')} />
          {isAdmin && <QuickAction icon="manage_accounts" label="User Management" onClick={() => navigate('staffManage')} />}
          <QuickAction icon="settings" label="Settings" onClick={() => goTo('settings')} />
          <QuickAction icon="bar_chart" label="Reports" disabled note="Coming soon" />
        </div>

        {isAdmin && (
          <>
            <div className="section-header">Recent Activity</div>
            <Card variant="elevated">
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
          </>
        )}
      </div>
    </>
  );
}

/** One tile in the Quick Actions grid. `disabled` + `note` covers the
 * "future-ready" Reports entry without needing a whole separate variant. */
function QuickAction({ icon, label, onClick, disabled, note }) {
  return (
    <button className="quick-action" onClick={onClick} disabled={disabled}>
      <div className="quick-action-icon"><Icon name={icon} /></div>
      <span className="quick-action-label">{label}</span>
      {note && <span className="quick-action-note">{note}</span>}
    </button>
  );
}

/** Small local helper so the JSX above stays readable. */
function useDisplaySession() {
  const { role, isAdmin } = useSession();
  // The pseudo-login has no staff name or ID yet — once real credential
  // auth lands (see SessionContext docstring) this reads session.staff's
  // real name/ID instead of the role placeholder, and nothing else here
  // needs to change since it's already the single place that reads it.
  const staffLabel = titleCase(role === 'ADMIN' ? 'Administrator' : 'Staff');
  return { staffLabel, role, isAdmin };
}
