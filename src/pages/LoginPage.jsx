import { Icon } from '../components/ui/Icon';
import { useSession } from '../context/SessionContext';

/**
 * Role-select screen. This is a PSEUDO login: tapping a card sets the
 * role client-side and drops straight into that role's UI — there is no
 * credential check. See SessionContext for how to upgrade this to real
 * auth without touching any other page.
 */
export function LoginPage() {
  const { login } = useSession();

  return (
    <div className="login-shell">
      <div className="login-logo"><Icon name="local_hospital" /></div>
      <div className="login-title">HRAPIMS</div>
      <div className="login-sub">Hospital Records &amp; Patient Information Management</div>

      <button className="role-card" onClick={() => login('STAFF')}>
        <div className="role-icon"><Icon name="badge" /></div>
        <div>
          <h3>Staff</h3>
          <p>Register, search and update patient records</p>
        </div>
        <Icon name="chevron_right" className="chev" />
      </button>

      <button className="role-card" onClick={() => login('ADMIN')}>
        <div className="role-icon"><Icon name="admin_panel_settings" /></div>
        <div>
          <h3>Administrator</h3>
          <p>Full access plus staff account management</p>
        </div>
        <Icon name="chevron_right" className="chev" />
      </button>

      <p style={{ fontSize: '.7rem', color: 'var(--md-on-surface-variant)', textAlign: 'center', marginTop: 8 }}>
        This is a preview build — tapping a role signs you in directly with no password.
        Real credential sign-in is coming before go-live.
      </p>
    </div>
  );
}
