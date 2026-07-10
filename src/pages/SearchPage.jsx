import { useState } from 'react';
import { TopBar, Icon, Spinner, Alert, EmptyState } from '../components/ui';
import { PatientCard } from '../components/patients/PatientCard';
import { useDebounce } from '../hooks/useDebounce';
import { useApiQuery } from '../hooks/useApiQuery';
import { useNavigation } from '../context/NavigationContext';

export function SearchPage() {
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 400);
  const { navigate } = useNavigation();
  const canSearch = debounced.trim().length >= 3;
  const { data, loading, error } = useApiQuery(
    canSearch ? `/patients/search?query=${encodeURIComponent(debounced)}&limit=50` : null,
    [debounced]
  );

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
            onChange={(e) => setQuery(e.target.value)}
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
              <p style={{ fontSize: '.78rem', color: 'var(--md-on-surface-variant)', marginBottom: 10 }}>
                Found {data.patients.length} patient(s)
              </p>
              {data.patients.map((p) => (
                <PatientCard key={p.folder_number} patient={p} onClick={() => navigate('patientDetail', { folderNumber: p.folder_number })} />
              ))}
            </>
          )}
        </div>
      </div>
    </>
  );
}
