const API_BASE = '/api';

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
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  // Real credential auth isn't wired up yet (see SessionContext) — this is
  // the seam where an Authorization header gets added once it is.
  const res = await fetch(API_BASE + path, { ...options, headers });
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
  fileUrl: (path) => API_BASE + path,
};
