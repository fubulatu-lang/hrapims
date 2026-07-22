// Centralized policy — the ONE place this lives on the client. The server
// (server/src/index.js) has the authoritative copy that's actually
// enforced; this one exists purely for instant UI feedback before a
// round trip. Keep both in sync if the policy ever changes.
export const PASSWORD_MIN_LENGTH = 8;

/** @returns {string|null} an error message, or null if the password is valid */
export function validatePassword(password) {
  if (!password) return 'Password is required';
  if (password.length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  if (!/[a-zA-Z]/.test(password)) return 'Password must contain at least one letter';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
  return null;
}

/** @returns {string|null} an error message, or null if the username is valid */
export function validateUsername(username) {
  if (!username) return 'Username is required';
  if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username)) return 'Username must be 3-30 characters (letters, numbers, dots, underscores, hyphens only)';
  return null;
}
