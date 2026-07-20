import { useState } from 'react';
import { TextField } from '../ui/TextField';

/**
 * The exact same field behavior everywhere a phone number is collected:
 * digits only, checkmark once 10 digits starting with 0 are entered, error
 * only shown after the person leaves the field (not while still typing).
 *
 * @param {object} props
 * @param {string} props.label
 * @param {string} props.value
 * @param {(value: string) => void} props.onChange
 * @param {boolean} [props.required]
 *
 * @example <PhoneField label="Phone" value={phone} onChange={setPhone} />
 * @example <PhoneField label="Contact" value={nokPhone} onChange={setNokPhone} />
 */
export function PhoneField({ label, value, onChange, required }) {
  const [touched, setTouched] = useState(false);
  const digits = (value || '').replace(/\D/g, '');
  const isValid = digits.length === 10 && digits.startsWith('0');
  const error = touched && value && !isValid
    ? 'Enter a 10-digit number starting with 0'
    : touched && required && !value ? `${label} is required` : undefined;

  return (
    <TextField
      label={label}
      type="tel"
      required={required}
      value={value}
      onChange={(v) => onChange(v.replace(/[^\d]/g, '').slice(0, 10))}
      onBlur={() => setTouched(true)}
      error={error}
      valid={isValid}
      placeholder="0201234567"
      inputMode="numeric"
    />
  );
}
