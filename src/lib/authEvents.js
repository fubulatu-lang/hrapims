// api.js is a plain module (no React), but it needs to force a logout when
// a request comes back 401 (expired/invalid session). SessionContext
// registers itself here once, on mount; api.js calls triggerLogout() and
// doesn't need to know anything about React state to do it.
let logoutHandler = null;

export function registerLogoutHandler(fn) {
  logoutHandler = fn;
}

export function triggerLogout() {
  logoutHandler?.();
}
