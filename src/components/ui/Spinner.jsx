/**
 * Loading indicator. Marked `role="status"` with a visually-hidden label
 * so screen readers announce "Loading" instead of silence.
 * @example <Spinner label="Loading patients" />
 */
export function Spinner({ label = 'Loading' }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px' }} role="status">
      <div className="spinner" />
      <span className="visually-hidden">{label}</span>
    </div>
  );
}
