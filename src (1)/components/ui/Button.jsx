import { forwardRef } from 'react';
import { Icon } from './Icon';
import { useFeedback } from '../../hooks/useFeedback';

/**
 * Primary action primitive. Wraps a native `<button>` so all standard DOM
 * props (onClick, type, aria-*, form, etc.) and refs pass through — the
 * component never hides platform behavior behind a custom API.
 *
 * @param {object} props
 * @param {'filled'|'tonal'|'outlined'|'text'|'danger'|'success'|'warning'} [props.variant='filled']
 * @param {'sm'|'md'|'xs'} [props.size='md']
 * @param {string} [props.icon] - Material Symbols name, shown before the label
 * @param {boolean} [props.fullWidth]
 * @param {boolean} [props.loading] - shows a spinner and sets aria-busy; button stays disabled
 * @param {React.ReactNode} props.children
 * @param {React.Ref<HTMLButtonElement>} ref
 *
 * @example
 * <Button variant="filled" icon="check_circle" onClick={save}>Save</Button>
 * <Button variant="outlined" size="sm">Cancel</Button>
 * <Button variant="danger" loading={isDeleting} onClick={onDelete}>Delete</Button>
 */
export const Button = forwardRef(function Button(
  { variant = 'filled', size = 'md', icon, fullWidth, loading, disabled, children, className = '', onClick, ...rest },
  ref
) {
  const feedback = useFeedback();
  const classes = [
    'btn',
    `btn-${variant}`,
    size === 'sm' ? 'btn-sm' : size === 'xs' ? 'btn-xs' : '',
    fullWidth ? 'btn-block' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      ref={ref}
      type="button"
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onClick={(e) => { feedback(); onClick?.(e); }}
      {...rest}
    >
      {loading ? <span className="btn-spinner" aria-hidden="true" /> : icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
});
