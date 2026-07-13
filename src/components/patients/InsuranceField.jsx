import { useState } from 'react';
import { TextField } from '../ui/TextField';
import { Alert } from '../ui/Alert';
import { api } from '../../lib/api';
import { titleCase } from '../../lib/format';

/**
 * Insurance number: digits only, capped at 8. A checkmark appears the
 * instant the 8th digit is typed, and the database is checked for a
 * duplicate at that same moment (not just on blur) — leaving the field
 * re-checks as a safety net (e.g. after a paste).
 *
 * @param {object} props
 * @param {string} props.value - digits only, up to 8 chars
 * @param {(digits: string) => void} props.onChange
 * @param {string} [props.excludeFolderNumber] - current patient's folder number, so editing your own record doesn't flag itself as a duplicate
 *
 * @example <InsuranceField value={insurance} onChange={setInsurance} excludeFolderNumber={folderNumber} />
 */
export function InsuranceField({ value, onChange, excludeFolderNumber }) {
  const [duplicate, setDuplicate] = useState(null);
  const [checking, setChecking] = useState(false);
  const digits = (value || '').slice(0, 8);
  const isValid = digits.length === 8;

  async function checkUnique(fullDigits) {
    setChecking(true);
    try {
      const res = await api.post('/patients/check-unique', { insuranceNumber: fullDigits, excludeFolderNumber });
      setDuplicate(res.insurance?.exists ? res.insurance.patient : null);
    } catch {
      /* Uniqueness check is a convenience, not a hard gate — the server
         re-validates on submit regardless, so a failed check here just
         means no warning shown, not a blocked save. */
    } finally {
      setChecking(false);
    }
  }

  function handleChange(v) {
    const nextDigits = v.replace(/\D/g, '').slice(0, 8);
    onChange(nextDigits);
    setDuplicate(null);
    if (nextDigits.length === 8) checkUnique(nextDigits);
  }

  function handleBlur() {
    if (digits.length === 0) { setDuplicate(null); return; }
    checkUnique(digits);
  }

  return (
    <div>
      <TextField
        label="Insurance Number"
        value={digits}
        onChange={handleChange}
        onBlur={handleBlur}
        valid={isValid && !duplicate}
        placeholder="8-digit number"
        inputMode="numeric"
        helperText={checking ? 'Checking…' : undefined}
      />
      {duplicate && (
        <Alert variant="warning">
          Already registered: {titleCase(duplicate.first_name)} {titleCase(duplicate.last_name)} ({duplicate.folder_number})
        </Alert>
      )}
    </div>
  );
}
