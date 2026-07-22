import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

/**
 * Fetches `path` on mount and whenever `deps` change. Every page uses this
 * for its main GET request so loading/error/empty states are handled
 * identically everywhere instead of each page reinventing them.
 *
 * @param {string|null} path - pass null to skip fetching (e.g. while a
 *   required param isn't ready yet)
 * @param {any[]} [deps=[]]
 * @returns {{data: any, loading: boolean, error: string|null, refetch: () => void}}
 *
 * @example
 * const { data, loading, error, refetch } = useApiQuery('/patients?limit=20');
 * if (loading) return <Spinner />;
 * if (error) return <Alert variant="error">{error}</Alert>;
 */
export function useApiQuery(path, deps = []) {
  const [state, setState] = useState({ data: null, loading: !!path, error: null });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!path) { setState({ data: null, loading: false, error: null }); return; }
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    api.get(path)
      .then((data) => { if (alive) setState({ data, loading: false, error: null }); })
      .catch((err) => { if (alive) setState({ data: null, loading: false, error: err.message }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, reloadKey, ...deps]);

  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);
  return { ...state, refetch };
}
