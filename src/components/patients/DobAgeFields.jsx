import { TextField } from '../ui/TextField';

/**
 * The date-of-birth / age pair, wired to `useDobAgeSync`. Kept as its own
 * component because the bidirectional-fill behavior is a self-contained
 * unit that's easy to get subtly wrong if reimplemented inline — one
 * owner, one place to fix bugs.
 *
 * @param {object} props
 * @param {ReturnType<typeof import('../../hooks/useDobAgeSync').useDobAgeSync>} props.sync
 * @param {string} [props.ageError]
 *
 * @example
 * const sync = useDobAgeSync(patient);
 * <DobAgeFields sync={sync} ageError={errors.age} />
 */
export function DobAgeFields({ sync, ageError }) {
  return (
    <div className="grid2">
      <TextField
        label="Date of Birth"
        type="date"
        value={sync.dob}
        onChange={sync.setDob}
        helperText="Fill this OR age"
      />
      <TextField
        label="Age (if DOB unknown)"
        type="number"
        value={sync.age}
        onChange={sync.setAge}
        error={ageError}
        min={0}
        max={150}
      />
    </div>
  );
}
