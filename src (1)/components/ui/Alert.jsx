import { Icon } from './Icon';

const ICONS = { error: 'error', success: 'check_circle', warning: 'warning', info: 'info' };

/**
 * Inline status banner. `error`/`warning` get `role="alert"` (interrupts
 * screen readers immediately); `success`/`info` get `role="status"`
 * (announced politely, doesn't interrupt).
 *
 * @param {object} props
 * @param {'error'|'success'|'warning'|'info'} [props.variant='info']
 * @example <Alert variant="error">Please fix the highlighted fields.</Alert>
 */
export function Alert({ variant = 'info', children }) {
  if (!children) return null;
  const isUrgent = variant === 'error' || variant === 'warning';
  return (
    <div className={`alert alert-${variant}`} role={isUrgent ? 'alert' : 'status'}>
      <Icon name={ICONS[variant]} />
      <span>{children}</span>
    </div>
  );
}
