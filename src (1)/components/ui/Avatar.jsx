import { initials } from '../../lib/format';

/**
 * @param {object} props
 * @param {string} props.firstName
 * @param {string} props.lastName
 * @param {'sm'|'md'|'lg'} [props.size='md']
 * @example <Avatar firstName="Jane" lastName="Doe" size="lg" />
 */
export function Avatar({ firstName, lastName, size = 'md', className = '' }) {
  const sizeClass = size === 'lg' ? 'lg' : '';
  return (
    <div className={`patient-avatar ${sizeClass} ${className}`} aria-hidden="true">
      {initials(firstName, lastName)}
    </div>
  );
}
