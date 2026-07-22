import { useState } from 'react';
import { TextField } from '../ui/TextField';
import { Alert } from '../ui/Alert';
import { api } from '../../lib/api';
import { titleCase } from '../../lib/format';

/** Ghana Card format: GHA- + 9 digits + - + 1 check digit = 10 digits total. */
export function formatNationalId(digits) {
  if (digits.length === 0) return 'GHA-';
  if (digits.length <= 9) return 'GHA-' + digits;
  return 'GHA-' + digits.slice(0, 9) + '-' + digits.slice(9);
}

/**
 * National ID field, prefilled with the "GHA-" prefix. As the person types
 * digits the second dash auto-appears after the 9th digit; a checkmark
 * appears once all 10 digits are entered. The database is checked for a
 * duplicate the instant the 10th digit is typed (not just on blur, so a
 * duplicate warning shows up immediately instead of waiting for the person
 * to tab away). Leaving the field re-checks as a safety net (e.g. after a
 * paste). If nothing was ever typed, the prefilled "GHA-" is discarded on
 * save rather than persisted as a value — the parent form is responsible
 * for that (it only receives digits from here, see PatientFormPage: empty
 * digits become `null` on submit).
 *
 * @param {object} props
 * @param {string} props.value - digits only (0-10 chars), NOT the formatted display string
 * @param {(digits: string) => void} props.onChange
 * @param {string} [props.excludeFolderNumber]
 * @param {boolean} [props.required] - driven by admin-configured field settings, see usePatientFieldConfig
 *
 * @example <NationalIdField value={nationalId} onChange={setNationalId} excludeFolderNumber={folderNumber} />
 */
export function NationalIdField({ value, onChange, excludeFolderNumber, required }) {
  const [duplicate, setDuplicate] = useState(null);
  const [checking, setChecking] = useState(false);
  const [touched, setTouched] = useState(false);
  const digits = (value || '').slice(0, 10);
  const isValid = digits.length === 10;
  const error = touched && digits.length > 0 && digits.length < 10
    ? 'National ID must be 10 digits (GHA-XXXXXXXXX-X)'
    : touched && required && digits.length === 0 ? 'National ID is required' : undefined;

  async function checkUnique(fullDigits) {
    setChecking(true);
    try {
      const res = await api.post('/patients/check-unique', { nationalIdNumber: formatNationalId(fullDigits), excludeFolderNumber });
      setDuplicate(res.nationalId?.exists ? res.nationalId.patient : null);
    } catch {
      /* non-blocking, see InsuranceField for rationale */
    } finally {
      setChecking(false);
    }
  }

  function handleChange(display) {
    // Only digits after "GHA-" are meaningful — re-derive from whatever's
    // typed so the prefix can't be edited/deleted out from under the mask.
    const nextDigits = display.replace(/\D/g, '').slice(0, 10);
    onChange(nextDigits);
    setDuplicate(null);
    if (nextDigits.length === 10) checkUnique(nextDigits);
  }

  function handleBlur() {
    setTouched(true);
    if (digits.length !== 10) { setDuplicate(null); return; }
    checkUnique(digits);
  }

  return (
    <div>
      <TextField
        label="National ID"
        required={required}
        value={formatNationalId(digits)}
        onChange={handleChange}
        onBlur={handleBlur}
        valid={isValid && !duplicate}
        error={error}
        helperText={!error && checking ? 'Checking…' : undefined}
      />
      {duplicate && (
        <Alert variant="warning">
          Already registered: {titleCase(duplicate.first_name)} {titleCase(duplicate.last_name)} ({duplicate.folder_number})
        </Alert>
      )}
    </div>
  );
}
