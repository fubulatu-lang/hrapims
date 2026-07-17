import { triggerLogout } from './authEvents';

const API_BASE = '/api';
const SESSION_KEY = 'hrapims.session';

function getToken() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw)?.token : null;
  } catch {
    return null;
  }
}

/**
 * Central fetch wrapper. Every request goes through here so there is one
 * place to add auth headers, retries, or error normalization later — pages
 * never call `fetch` directly.
 *
 * @param {string} path - API path, e.g. '/patients' (leading slash required)
 * @param {RequestInit} [options]
 * @returns {Promise<any>} parsed JSON body
 * @throws {Error} with a human-readable `.message` on any non-2xx response
 */
export async function apiRequest(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  const res = await fetch(API_BASE + path, { ...options, headers });
  if (res.status === 401) {
    triggerLogout();
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Session expired. Please sign in again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  get: (path) => apiRequest(path),
  post: (path, body) => apiRequest(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => apiRequest(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path, body) => apiRequest(path, { method: 'DELETE', body: body ? JSON.stringify(body) : undefined }),
  /**
   * Downloads a file (CSV exports) through a real authenticated fetch —
   * `window.open`/plain links can't carry an Authorization header, so
   * those would 401 now that sessions are real. Fetches as a blob and
   * triggers a save via a throwaway <a download> element instead.
   * @param {string} path
   * @param {string} filename
   */
  async download(path, filename) {
    const token = getToken();
    const res = await fetch(API_BASE + path, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.status === 401) { triggerLogout(); throw new Error('Session expired. Please sign in again.'); }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Download failed (${res.status})`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
