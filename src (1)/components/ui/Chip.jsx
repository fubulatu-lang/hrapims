import { Icon } from './Icon';

/**
 * @param {object} props
 * @param {'primary'|'success'|'error'|'warning'|'neutral'} [props.variant='neutral']
 * @param {string} [props.icon]
 * @example <Chip variant="error" icon="delete">Deleted</Chip>
 */
export function Chip({ variant = 'neutral', icon, children, className = '' }) {
  return (
    <span className={`chip chip-${variant} ${className}`}>
      {icon && <Icon name={icon} />}
      {children}
    </span>
  );
}
