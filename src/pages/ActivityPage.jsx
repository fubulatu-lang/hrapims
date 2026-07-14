import { Fragment, useState } from 'react';
import { TopBar, IconButton, Card, Chip, Spinner, Alert, EmptyState, Button } from '../components/ui';
import { useApiQuery } from '../hooks/useApiQuery';
import { usePageState } from '../hooks/usePageState';
import { api } from '../lib/api';
import { formatDateTime } from '../lib/format';

export function ActivityPage() {
  const [page, setPage] = usePageState('activity.page', 1);
  const [filters, setFilters] = usePageState('activity.filters', { patient: '', start: '', end: '' });
  const [expandedId, setExpandedId] = useState(null);

  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (filters.patient) params.set('patientId', filters.patient);
  if (filters.start) params.set('startDate', filters.start);
  if (filters.end) params.set('endDate', filters.end);

  const { data, loading, error } = useApiQuery(`/activity?${params.toString()}`, [page, filters]);

  function updateFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  return (
    <>
      <TopBar
        title="Activity Log"
        trailing={<IconButton icon="download" label="Export activity CSV" onClick={() => downloadActivity(filters)} />}
      />
      <div className="main-content">
        <Card>
          <div className="row">
            <div className="field-group">
              <label className="label" htmlFor="af-patient">Patient Folder #</label>
              <input id="af-patient" className="input" value={filters.patient} onChange={(e) => updateFilter('patient', e.target.value)} />
            </div>
            <div className="field-group">
              <label className="label" htmlFor="af-start">Start Date</label>
              <input id="af-start" className="input" type="date" value={filters.start} onChange={(e) => updateFilter('start', e.target.value)} />
            </div>
            <div className="field-group">
              <label className="label" htmlFor="af-end">End Date</label>
              <input id="af-end" className="input" type="date" value={filters.end} onChange={(e) => updateFilter('end', e.target.value)} />
            </div>
          </div>
          <Button variant="text" size="xs" icon="close" onClick={() => setFilters({ patient: '', start: '', end: '' })}>Clear filters</Button>
        </Card>

        {loading && <Spinner label="Loading activity log" />}
        {error && <Alert variant="error">{error}</Alert>}
        {data && data.logs.length === 0 && <EmptyState icon="inbox" title="No activity logged" />}

        {data && data.logs.length > 0 && (
          <Card style={{ overflowX: 'auto', padding: 8 }}>
            <table>
              <thead><tr><th>Time</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
              <tbody>
                {data.logs.map((l) => {
                  let detail = null;
                  try { detail = l.details ? JSON.parse(l.details) : null; } catch { /* ignore */ }
                  const summary = detail?.changes
                    ? `${Object.keys(detail.changes).join(', ')} changed`
                    : detail?.initialData ? 'Created record'
                    : detail?.mergedFrom ? `Merged from ${detail.mergedFrom}`
                    : '—';
                  const variant = l.action.includes('DELETE') ? 'error' : l.action.includes('CREATE') ? 'success' : 'primary';
                  const isOpen = expandedId === l.id;
                  return (
                    <Fragment key={l.id}>
                      <tr className="clickable" onClick={() => setExpandedId(isOpen ? null : l.id)}>
                        <td style={{ fontSize: '.72rem', whiteSpace: 'nowrap' }}>{formatDateTime(l.created_at)}</td>
                        <td><Chip variant={variant}>{l.action}</Chip></td>
                        <td>{l.entity_type}<br /><span style={{ fontSize: '.7rem' }}>{l.entity_id || '—'}</span></td>
                        <td style={{ fontSize: '.75rem' }}>{summary}</td>
                      </tr>
                      {isOpen && detail && (
                        <tr>
                          <td colSpan={4}><pre className="json-view">{JSON.stringify(detail, null, 2)}</pre></td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}

        {data?.pagination?.pages > 1 && (
          <div style={{ textAlign: 'center', margin: 16 }}>
            <IconButton icon="chevron_left" label="Previous page" variant="tonal" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} />
            <span style={{ fontWeight: 600, margin: '0 12px' }}>{page}/{data.pagination.pages}</span>
            <IconButton icon="chevron_right" label="Next page" variant="tonal" disabled={page >= data.pagination.pages} onClick={() => setPage((p) => p + 1)} />
          </div>
        )}
      </div>
    </>
  );
}

function downloadActivity(filters) {
  const params = new URLSearchParams();
  if (filters.start) params.set('startDate', filters.start);
  if (filters.end) params.set('endDate', filters.end);
  window.open(api.fileUrl(`/export/activity?${params.toString()}`), '_blank');
}
