import { useState } from 'react';
import { Icon } from '../components/ui/Icon';
import { TextField } from '../components/ui/TextField';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { useSession } from '../context/SessionContext';

/**
 * Real credential sign-in. Success re-renders `App`'s Gate with an
 * authenticated session — this component doesn't need to know or care
 * whether that lands on the main app or the forced password-change
 * screen, `mustChangePassword` on the session decides that.
 */
export function LoginPage() {
  const { login } = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Enter your username and password');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-logo"><Icon name="local_hospital" /></div>
      <div className="login-title">HRAPIMS</div>
      <div className="login-sub">Hospital Records &amp; Patient Information Management</div>

      <form onSubmit={handleSubmit} style={{ width: '100%' }}>
        <Alert variant="error">{error}</Alert>
        <TextField
          label="Username"
          required
          autoComplete="username"
          value={username}
          onChange={setUsername}
        />
        <TextField
          label="Password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
        />
        <Button type="submit" fullWidth loading={submitting} icon="login">Sign In</Button>
      </form>

      <p style={{ fontSize: '.72rem', color: 'var(--md-on-surface-variant)', textAlign: 'center', marginTop: 16 }}>
        Forgot your password? Ask an administrator to reset it from Staff Management.
      </p>
    </div>
  );
}
