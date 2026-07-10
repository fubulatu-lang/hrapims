import { useId } from 'react';
import { Icon } from './Icon';

/**
 * Select field with the same label/error contract as TextField, so a form
 * can mix the two without any visual or behavioral inconsistency.
 *
 * @param {object} props
 * @param {string} props.label
 * @param {string} props.value
 * @param {(value: string) => void} props.onChange
 * @param {{value: string, label: string}[]} props.options
 * @param {string} [props.placeholder='Select...']
 * @param {string} [props.error]
 * @param {boolean} [props.required]
 *
 * @example
 * <Select
 *   label="Gender"
 *   required
 *   value={gender}
 *   onChange={setGender}
 *   options={[{value:'Male',label:'Male'},{value:'Female',label:'Female'},{value:'Other',label:'Other'}]}
 *   error={errors.gender}
 * />
 */
export function Select({ label, value, onChange, options, placeholder = 'Select...', error, required, id, className = '', ...rest }) {
  const autoId = useId();
  const fieldId = id || autoId;
  const errorId = `${fieldId}-error`;

  return (
    <div className={`field-group ${className}`}>
      <label className="label" htmlFor={fieldId}>{label}{required ? ' *' : ''}</label>
      <select
        id={fieldId}
        className={`input${error ? ' md-error' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : undefined}
        aria-required={required || undefined}
        {...rest}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && (
        <div className="field-error" id={errorId} role="alert">
          <Icon name="error" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
