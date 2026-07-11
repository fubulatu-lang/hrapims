import { useEffect, useId, useRef, useState } from 'react';
import { IconButton } from './IconButton';

/** "15031990" -> "15-03-1990"; dashes auto-appear after day and month. */
function maskDisplay(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  const day = digits.slice(0, 2), month = digits.slice(2, 4), year = digits.slice(4, 8);
  return [day, month, year].filter(Boolean).join('-');
}

/** "15-03-1990" -> "1990-03-15" (ISO), or null if incomplete/invalid. */
function displayToIso(display) {
  const digits = display.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  const day = parseInt(digits.slice(0, 2), 10);
  const month = parseInt(digits.slice(2, 4), 10);
  const year = parseInt(digits.slice(4, 8), 10);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > new Date().getFullYear()) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** "1990-03-15" (ISO) -> "15-03-1990" for display. */
function isoToDisplay(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '';
  return `${d}-${m}-${y}`;
}

/**
 * Date field the person can either type into (DD-MM-YYYY, dashes appear
 * automatically) or pick from a native date picker via the calendar
 * button beside it. Both paths update the same underlying ISO value.
 *
 * @param {object} props
 * @param {string} props.label
 * @param {string} props.value - ISO date string ("YYYY-MM-DD") or ''
 * @param {(iso: string) => void} props.onChange
 * @param {string} [props.helperText]
 * @example <DateField label="Date of Birth" value={dob} onChange={setDob} />
 */
export function DateField({ label, value, onChange, helperText }) {
  const [display, setDisplay] = useState(() => isoToDisplay(value));
  const hiddenRef = useRef(null);
  const fieldId = useId();

  // Keep the visible text in sync when `value` changes from elsewhere
  // (e.g. the age field pushing a computed date into this one).
  useEffect(() => { setDisplay(isoToDisplay(value)); }, [value]);

  function handleTextChange(raw) {
    const masked = maskDisplay(raw);
    setDisplay(masked);
    const iso = displayToIso(masked);
    if (iso) onChange(iso);
    else if (masked === '') onChange('');
  }

  function openPicker() {
    const el = hiddenRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') el.showPicker();
    else el.click();
  }

  return (
    <div className="field-group">
      <label className="label" htmlFor={fieldId}>{label}</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <input
          id={fieldId}
          className="input"
          style={{ flex: 1 }}
          value={display}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="DD-MM-YYYY"
          inputMode="numeric"
        />
        <IconButton icon="calendar_month" label="Pick a date" variant="tonal" onClick={openPicker} />
        {/* Visually hidden native picker — the calendar button triggers it;
            typing in the text field above never touches this element. */}
        <input
          ref={hiddenRef}
          type="date"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="visually-hidden"
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>
      {helperText && <div className="field-help">{helperText}</div>}
    </div>
  );
}
