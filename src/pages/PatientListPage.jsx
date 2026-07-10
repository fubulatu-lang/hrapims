import { useState } from 'react';
import { TopBar, IconButton, Spinner, Alert, EmptyState, Button } from '../components/ui';
import { PatientCard } from '../components/patients/PatientCard';
import { useApiQuery } from '../hooks/useApiQuery';
import { useNavigation } from '../context/NavigationContext';

export function PatientListPage() {
  const [page, setPage] = useState(1);
  const { navigate } = useNavigation();
  const { data, loading, error } = useApiQuery(`/patients?page=${page}&limit=20&showDeleted=true`, [page]);

  return (
    <>
      <TopBar title="Patients" subtitle={data ? `${data.pagination.total} records` : undefined} />
      <div className="main-content">
        {loading && <Spinner label="Loading patients" />}
        {error && <Alert variant="error">{error}</Alert>}

        {data && data.patients.length === 0 && (
          <EmptyState
            icon="inbox"
            title="No patients registered yet"
            action={<Button onClick={() => navigate('patientForm')}>Register First Patient</Button>}
          />
        )}

        {data?.patients.map((p) => (
          <PatientCard key={p.folder_number} patient={p} onClick={() => navigate('patientDetail', { folderNumber: p.folder_number })} />
        ))}

        {data?.pagination?.pages > 1 && (
          <div style={{ textAlign: 'center', margin: '20px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <IconButton icon="chevron_left" label="Previous page" variant="tonal" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} />
            <span style={{ fontWeight: 600, fontSize: '.85rem' }}>Page {page} of {data.pagination.pages}</span>
            <IconButton icon="chevron_right" label="Next page" variant="tonal" disabled={page >= data.pagination.pages} onClick={() => setPage((p) => p + 1)} />
          </div>
        )}
      </div>
    </>
  );
}
