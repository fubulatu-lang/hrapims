/**
 * Mirrors PATIENT_FIELD_REGISTRY in server/src/index.js exactly (same
 * keys, same order). Kept as a hand-maintained duplicate rather than a
 * shared package — this is a two-file project (client/server), and a
 * monorepo-shared-package split would be more machinery than nine fields
 * justifies. If this ever grows past "occasionally add one field," that's
 * the signal to actually share it.
 *
 * The `key` is the one thing that must never drift between the two
 * copies — it's the join key between "what the admin configured" and
 * "which bit of UI that maps to."
 */
export const PATIENT_FIELD_REGISTRY = [
  { key: 'dobAge', label: 'Date of Birth / Age', section: 'Personal Information' },
  { key: 'phone', label: 'Phone', section: 'Personal Information' },
  { key: 'nationalId', label: 'National ID', section: 'Identification' },
  { key: 'insurance', label: 'Insurance Number', section: 'Identification' },
  { key: 'height', label: 'Height', section: 'Physical' },
  { key: 'weight', label: 'Weight', section: 'Physical' },
  { key: 'nextOfKinName', label: 'Next of Kin Name', section: 'Next of Kin' },
  { key: 'nextOfKinContact', label: 'Next of Kin Contact', section: 'Next of Kin' },
  { key: 'allergies', label: 'Allergies', section: 'Medical' },
  { key: 'chronicConditions', label: 'Chronic Conditions', section: 'Medical' },
];
