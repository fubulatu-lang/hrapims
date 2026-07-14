import { TopBar, IconButton, Icon, Spinner, Alert, EmptyState, SortControl } from '../components/ui';
import { PatientCard } from '../components/patients/PatientCard';
import { useDebounce } from '../hooks/useDebounce';
import { useApiQuery } from '../hooks/useApiQuery';
import { useSort } from '../hooks/useSort';
import { usePageState } from '../hooks/usePageState';
import { useNavigation } from '../context/NavigationContext';

export function SearchPage() {
  const [query, setQuery] = usePageState('search.query', '');
  const [page, setPage] = usePageState('search.page', 1);
  const debounced = useDebounce(query, 400);
  const { navigate } = useNavigation();
  const { sortBy, sortDir, setSort, queryParams } = useSort();
  const canSearch = debounced.trim().length >= 3;
  const { data, loading, error } = useApiQuery(
    canSearch ? `/patients/search?query=${encodeURIComponent(debounced)}&page=${page}&limit=20&${queryParams}` : null,
    [debounced, page, queryParams]
  );

  function handleQueryChange(v) {
    setQuery(v);
    setPage(1);
  }

  return (
    <>
      <TopBar title="Search" />
      <div className="main-content">
        <div className="card elevated" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 14px' }}>
          <Icon name="search" />
          <input
            className="input"
            style={{ border: 'none', background: 'transparent', padding: '12px 0' }}
            placeholder="Name, ID, phone, location, allergies..."
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            autoFocus
            aria-label="Search patients"
          />
        </div>

        <div style={{ marginTop: 14 }}>
          {!canSearch && <EmptyState icon="person_search" title="Enter at least 3 characters to search" />}
          {canSearch && loading && <Spinner label="Searching" />}
          {canSearch && error && <Alert variant="error">{error}</Alert>}
          {canSearch && data && data.patients.length === 0 && (
            <EmptyState icon="person_search" title={`No results for "${debounced}"`} />
          )}
          {canSearch && data && data.patients.length > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <p style={{ fontSize: '.78rem', color: 'var(--md-on-surface-variant)' }}>
                  {data.pagination.total} matching patient{data.pagination.total === 1 ? '' : 's'}
                </p>
                <SortControl sortBy={sortBy} sortDir={sortDir} onChange={(by, dir) => { setSort(by, dir); setPage(1); }} />
              </div>
              {data.patients.map((p) => (
                <PatientCard key={p.folder_number} patient={p} onClick={() => navigate('patientDetail', { folderNumber: p.folder_number })} />
              ))}
              {data.pagination.pages > 1 && (
                <div style={{ textAlign: 'center', margin: '20px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <IconButton icon="chevron_left" label="Previous page" variant="tonal" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} />
                  <span style={{ fontWeight: 600, fontSize: '.85rem' }}>Page {page} of {data.pagination.pages}</span>
                  <IconButton icon="chevron_right" label="Next page" variant="tonal" disabled={page >= data.pagination.pages} onClick={() => setPage((p) => p + 1)} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
