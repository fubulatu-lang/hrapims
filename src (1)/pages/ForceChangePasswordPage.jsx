import { useState } from 'react';
import { Icon } from '../components/ui/Icon';
import { TextField } from '../components/ui/TextField';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { useSession } from '../context/SessionContext';
import { api } from '../lib/api';
import { validatePassword } from '../lib/validation';

/**
 * Shown instead of the app shell whenever `session.mustChangePassword` is
 * true — after a fresh account creation or an admin-triggered reset. No
 * "skip" option by design: the temporary password was shown to an admin
 * once and shared out of band, so it shouldn't remain valid indefinitely.
 */
export function ForceChangePasswordPage() {
  const { clearMustChangePassword, logout } = useSession();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const policyError = validatePassword(newPassword);
    if (policyError) { setError(policyError); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    setError(null);
    setSubmitting(true);
    try {
      // No currentPassword sent — the server skips that check specifically
      // when must_change_password is true (see server/src/index.js).
      await api.post('/auth/change-password', { newPassword });
      clearMustChangePassword();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-logo"><Icon name="lock_reset" /></div>
      <div className="login-title">Set a New Password</div>
      <div className="login-sub">
        Choose a password only you know. You'll use it every time you sign in — at least 8 characters, with at least one letter and one number.
      </div>

      <form onSubmit={handleSubmit} style={{ width: '100%' }}>
        <Alert variant="error">{error}</Alert>
        <TextField label="New Password" type="password" required autoComplete="new-password" value={newPassword} onChange={setNewPassword} />
        <TextField label="Confirm Password" type="password" required autoComplete="new-password" value={confirmPassword} onChange={setConfirmPassword} />
        <Button type="submit" fullWidth loading={submitting} icon="check_circle">Save &amp; Continue</Button>
      </form>

      <Button variant="text" size="sm" onClick={logout} style={{ marginTop: 8 }}>Sign out instead</Button>
    </div>
  );
}
