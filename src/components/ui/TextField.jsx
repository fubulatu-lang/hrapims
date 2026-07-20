import { useId, useState } from 'react';
import { Icon } from './Icon';

/**
 * Controlled text field with the label/error/helper-text pattern used
 * everywhere in the app. This is the ONE place the "red glow + message
 * below" validation UI is implemented — pages never touch the DOM to show
 * an error, they just pass an `error` string.
 *
 * Accessibility: the input is linked to its label via `htmlFor`/`id`, and
 * to its error or helper text via `aria-describedby`; `aria-invalid` is
 * set whenever `error` is present. Password fields get a show/hide toggle
 * automatically — no page needs to opt in or wire anything for it.
 *
 * @param {object} props
 * @param {string} props.label
 * @param {string} props.value
 * @param {(value: string) => void} props.onChange
 * @param {string} [props.error] - validation message; renders red outline + text below
 * @param {string} [props.helperText] - shown below the field when there's no error
 * @param {boolean} [props.required]
 * @param {boolean} [props.valid] - show a green checkmark (e.g. after async uniqueness check)
 * @param {'text'|'tel'|'number'|'date'|'password'} [props.type='text']
 * @param {boolean} [props.multiline] - renders a <textarea> instead of <input>
 * @param {number} [props.rows=3]
 * @param {string} [props.id]
 * @param {(e: React.FocusEvent) => void} [props.onBlur]
 *
 * @example
 * <TextField
 *   label="First Name"
 *   required
 *   value={firstName}
 *   onChange={setFirstName}
 *   onBlur={() => validate('firstName')}
 *   error={errors.firstName}
 * />
 * @example <TextField label="Password" type="password" value={pw} onChange={setPw} />
 */
export function TextField({
  label,
  value,
  onChange,
  error,
  helperText,
  required,
  valid,
  type = 'text',
  multiline,
  rows = 3,
  id,
  className = '',
  ...rest
}) {
  const autoId = useId();
  const fieldId = id || autoId;
  const errorId = `${fieldId}-error`;
  const helpId = `${fieldId}-help`;
  const describedBy = error ? errorId : helperText ? helpId : undefined;
  const isPassword = type === 'password';
  const [revealed, setRevealed] = useState(false);
  const effectiveType = isPassword && revealed ? 'text' : type;
  const inputClasses = [
    'input',
    error ? 'md-error' : '',
    valid && !error ? 'valid' : '',
    isPassword ? 'has-toggle' : '',
  ].filter(Boolean).join(' ');

  const sharedProps = {
    id: fieldId,
    className: inputClasses,
    value,
    onChange: (e) => onChange(e.target.value),
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': describedBy,
    'aria-required': required || undefined,
    ...rest,
  };

  return (
    <div className={`field-group ${className}`}>
      <label className="label" htmlFor={fieldId}>{label}{required ? ' *' : ''}</label>
      {multiline ? <textarea rows={rows} {...sharedProps} /> : <input type={effectiveType} {...sharedProps} />}
      {isPassword && (
        <button
          type="button"
          className="input-toggle"
          onClick={() => setRevealed((r) => !r)}
          aria-label={revealed ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          <Icon name={revealed ? 'visibility_off' : 'visibility'} />
        </button>
      )}
      {valid && !error && <Icon name="check_circle" className="input-check" />}
      {error && (
        <div className="field-error" id={errorId} role="alert">
          <Icon name="error" />
          <span>{error}</span>
        </div>
      )}
      {!error && helperText && (
        <div className="field-help" id={helpId}>{helperText}</div>
      )}
    </div>
  );
}
