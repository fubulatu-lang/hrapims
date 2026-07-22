import { IconButton } from './IconButton';

export const SORT_OPTIONS = [
  { value: 'created', label: 'Recently Added' },
  { value: 'name', label: 'Name' },
  { value: 'age', label: 'Age' },
  { value: 'folder', label: 'Folder Number' },
];

/**
 * Sort-by + direction control. Used identically on the Patients list and
 * Search results so the two screens can never drift apart on how sorting
 * works — same options, same defaults, same visual control.
 *
 * @param {object} props
 * @param {string} props.sortBy - one of SORT_OPTIONS values
 * @param {'asc'|'desc'} props.sortDir
 * @param {(sortBy: string, sortDir: 'asc'|'desc') => void} props.onChange
 *
 * @example
 * <SortControl sortBy={sortBy} sortDir={sortDir} onChange={(by, dir) => { setSortBy(by); setSortDir(dir); }} />
 */
export function SortControl({ sortBy, sortDir, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <select
        className="input"
        style={{ padding: '8px 30px 8px 12px', fontSize: '.8rem', width: 'auto' }}
        value={sortBy}
        onChange={(e) => onChange(e.target.value, sortDir)}
        aria-label="Sort by"
      >
        {SORT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
      <IconButton
        icon={sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}
        label={sortDir === 'asc' ? 'Sort ascending (tap to switch)' : 'Sort descending (tap to switch)'}
        variant="tonal"
        onClick={() => onChange(sortBy, sortDir === 'asc' ? 'desc' : 'asc')}
      />
    </div>
  );
}
