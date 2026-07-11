import { Icon } from './Icon';
import { useFeedback } from '../../hooks/useFeedback';

/**
 * Floating action button, fixed above the bottom nav. Use for the single
 * primary action of a screen (e.g. "New Patient") — not for secondary
 * actions, which belong in a menu or the app bar.
 *
 * @param {object} props
 * @param {string} props.icon
 * @param {string} [props.label] - if given, renders as an extended FAB with visible text
 * @example <Fab icon="add" label="New Patient" onClick={() => navigate('new')} />
 */
export function Fab({ icon, label, onClick }) {
  const feedback = useFeedback();
  return (
    <button className={`fab ${label ? 'fab-extended' : ''}`} onClick={(e) => { feedback(); onClick?.(e); }} aria-label={label || 'Action'}>
      <Icon name={icon} />
      {label && <span>{label}</span>}
    </button>
  );
}
