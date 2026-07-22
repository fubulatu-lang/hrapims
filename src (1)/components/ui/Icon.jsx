/**
 * Wraps a Material Symbols ligature name in the right span/classes. Every
 * icon in the app goes through this component so there's one place to
 * swap icon sets later if needed.
 *
 * @param {{name: string, className?: string, ['aria-hidden']?: boolean}} props
 * @example <Icon name="home" />
 * @example <Icon name="delete" className="danger-icon" />
 */
export function Icon({ name, className = '', ...rest }) {
  return (
    <span className={`material-symbols-outlined${className ? ' ' + className : ''}`} aria-hidden="true" {...rest}>
      {name}
    </span>
  );
}
