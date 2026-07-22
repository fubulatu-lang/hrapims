import { Icon } from './Icon';

/**
 * @param {object} props
 * @param {string} props.icon
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {React.ReactNode} [props.action]
 * @example
 * <EmptyState icon="inbox" title="No patients registered yet"
 *   action={<Button onClick={onNew}>Register First Patient</Button>} />
 */
export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="empty-state">
      <Icon name={icon} />
      <p>{title}</p>
      {description && <p style={{ fontSize: '.78rem', marginTop: 4 }}>{description}</p>}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}
