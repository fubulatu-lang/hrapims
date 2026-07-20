import { useMemo } from 'react';
import { useApiQuery } from './useApiQuery';
import { PATIENT_FIELD_REGISTRY } from '../lib/patientFields';

/**
 * Fetches the admin-configured patient field settings (which optional
 * fields show on the registration form, and which of those are
 * required). Falls back to "everything enabled, nothing required" while
 * loading or if the request fails, so the form is still usable — a
 * configuration fetch failing shouldn't block patient registration.
 *
 * @returns {{
 *   loading: boolean,
 *   isEnabled: (key: string) => boolean,
 *   isRequired: (key: string) => boolean,
 * }}
 *
 * @example
 * const fields = usePatientFieldConfig();
 * {fields.isEnabled('nationalId') && <NationalIdField required={fields.isRequired('nationalId')} .../>}
 */
export function usePatientFieldConfig() {
  const { data, loading } = useApiQuery('/settings/patient-fields');

  return useMemo(() => {
    const byKey = new Map((data?.fields || []).map((f) => [f.key, f]));
    const isEnabled = (key) => byKey.has(key) ? byKey.get(key).enabled : true;
    const isRequired = (key) => byKey.has(key) ? byKey.get(key).required : false;
    return { loading, isEnabled, isRequired };
  }, [data, loading]);
}

export { PATIENT_FIELD_REGISTRY };
