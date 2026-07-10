import { forwardRef } from 'react';
import { Icon } from './Icon';

/**
 * An icon-only button. `label` is required and becomes the accessible
 * name (aria-label) — there is no visible text, so without it the button
 * is invisible to screen readers.
 *
 * @param {object} props
 * @param {string} props.icon - Material Symbols name
 * @param {string} props.label - accessible name, e.g. "Close dialog"
 * @param {'standard'|'tonal'} [props.variant='standard']
 * @param {React.Ref<HTMLButtonElement>} ref
 *
 * @example <IconButton icon="close" label="Close dialog" onClick={onClose} />
 * @example <IconButton icon="more_vert" label="More actions" variant="tonal" onClick={openMenu} />
 */
export const IconButton = forwardRef(function IconButton(
  { icon, label, variant = 'standard', className = '', ...rest },
  ref
) {
  const classes = ['icon-btn', variant === 'tonal' ? 'filled-tonal' : '', className].filter(Boolean).join(' ');
  return (
    <button ref={ref} type="button" className={classes} aria-label={label} title={label} {...rest}>
      <Icon name={icon} />
    </button>
  );
});
