import { useCallback, useState } from 'react';
import { calcAgeFromDob } from '../lib/format';

/**
 * Encapsulates the "date of birth OR age" rule used on the patient form:
 * editing one field derives the other, and the hook remembers which field
 * the person actually typed in — because a DOB derived *from* an age is
 * always an estimate (Jan 1 of the birth year), while a directly-entered
 * DOB is exact. That distinction is what the server stores as
 * `isAgeEstimated`.
 *
 * @param {{dateOfBirth?: string|null, age?: number|null, isAgeEstimated?: boolean}} [initial]
 */
export function useDobAgeSync(initial = {}) {
  const [dob, setDobRaw] = useState(initial.dateOfBirth ? initial.dateOfBirth.slice(0, 10) : '');
  const [age, setAgeRaw] = useState(initial.age != null ? String(initial.age) : '');
  const [source, setSource] = useState(initial.isAgeEstimated ? 'age' : initial.dateOfBirth ? 'dob' : null);

  const setDob = useCallback((value) => {
    setDobRaw(value);
    if (!value) { setSource(null); return; }
    setSource('dob');
    const computed = calcAgeFromDob(value);
    setAgeRaw(computed >= 0 ? String(computed) : '');
  }, []);

  const setAge = useCallback((value) => {
    setAgeRaw(value);
    if (value === '') { setSource(null); return; }
    const n = parseInt(value, 10);
    if (Number.isNaN(n) || n < 0 || n > 150) return; // caller validates & shows the error
    setSource('age');
    const year = new Date().getFullYear() - n;
    setDobRaw(`${year}-01-01`);
  }, []);

  return { dob, age, isAgeEstimated: source === 'age', setDob, setAge };
}
