/**
 * Title-cases a name at word boundaries (space, hyphen, apostrophe), e.g.
 * "mary-jane o'brien" -> "Mary-Jane O'Brien". Mirrors the server-side rule
 * exactly so the UI never shows different casing than what gets persisted.
 * @param {string|null|undefined} str
 * @returns {string}
 */
export function titleCase(str) {
  if (!str) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/(^|[\s\-'])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());
}

/** @returns {string} up to 2 uppercase initials for an avatar */
export function initials(first, last) {
  const a = (first || '?')[0] || '?';
  const b = (last || '')[0] || '';
  return (a + b).toUpperCase();
}

/** @returns {number} age in whole years for a given date-of-birth */
export function calcAgeFromDob(dobString) {
  const dob = new Date(dobString);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

export function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}
export function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}
