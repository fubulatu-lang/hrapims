import { useEffect, useState } from 'react';
import { TopBar, BackButton, Card, CardTitle, TextField, Select, Button, Alert } from '../components/ui';
import { DobAgeFields } from '../components/patients/DobAgeFields';
import { PhoneField } from '../components/patients/PhoneField';
import { InsuranceField } from '../components/patients/InsuranceField';
import { NationalIdField, formatNationalId } from '../components/patients/NationalIdField';
import { useDobAgeSync } from '../hooks/useDobAgeSync';
import { usePersistentDraft } from '../hooks/usePersistentDraft';
import { useApiQuery } from '../hooks/useApiQuery';
import { usePatientFieldConfig } from '../hooks/usePatientFieldConfig';
import { useNavigation } from '../context/NavigationContext';
import { api } from '../lib/api';
import { titleCase } from '../lib/format';

const GENDER_OPTIONS = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Other', label: 'Other' },
];

const DRAFT_KEY = 'hrapims.draft.newPatient';
const EMPTY_DRAFT = {
  firstName: '', lastName: '', gender: '', phone: '', location: '',
  nationalId: '', insurance: '', height: '', weight: '',
  nokName: '', nokPhone: '', allergies: '', conditions: '',
  dob: '', age: '', ageEstimated: false,
};

export function PatientFormPage() {
  const { params, navigate, replace, back } = useNavigation();
  const isEdit = !!params.folderNumber;
  const existing = useApiQuery(isEdit ? `/patients/${params.folderNumber}` : null);
  const fields = usePatientFieldConfig();

  // Wait for the existing record to load before mounting the form body so
  // every field initializes from real data exactly once (no flash of an
  // empty form followed by a refill).
  if (isEdit && existing.loading) return (<><TopBar title="Edit Patient" leading={<BackButton onClick={back} />} /></>);
  if (isEdit && existing.error) return (<><TopBar title="Edit Patient" leading={<BackButton onClick={back} />} /><div className="main-content"><Alert variant="error">{existing.error}</Alert></div></>);

  return <PatientFormBody isEdit={isEdit} initial={existing.data} fields={fields} onBack={back} onSaved={replace} />;
}

function patientToDraft(p) {
  return {
    firstName: p.first_name ? titleCase(p.first_name) : '',
    lastName: p.last_name ? titleCase(p.last_name) : '',
    gender: p.gender || '',
    phone: p.phone_number || '',
    location: p.location || '',
    nationalId: (p.national_id_number || '').replace(/\D/g, ''),
    insurance: p.insurance_number || '',
    height: p.height ?? '',
    weight: p.weight ?? '',
    nokName: p.next_of_kin_name ? titleCase(p.next_of_kin_name) : '',
    nokPhone: p.next_of_kin_contact || '',
    allergies: p.allergies || '',
    conditions: p.chronic_conditions || '',
    dob: p.date_of_birth ? p.date_of_birth.slice(0, 10) : '',
    age: p.age != null ? String(p.age) : '',
    ageEstimated: !!p.is_age_estimated,
  };
}

function PatientFormBody({ isEdit, initial, fields, onBack, onSaved }) {
  const p = initial || {};

  // New patients get an auto-saved draft (survives an accidental close);
  // editing an existing record just starts from its current values —
  // there's nothing to "recover" since the server already has it.
  const [persisted, setPersisted, clearPersisted] = usePersistentDraft(DRAFT_KEY, EMPTY_DRAFT);
  const [editDraft, setEditDraft] = useState(() => (isEdit ? patientToDraft(p) : EMPTY_DRAFT));
  const draft = isEdit ? editDraft : persisted;
  const setDraft = isEdit ? setEditDraft : setPersisted;
  function set(field) { return (value) => setDraft((d) => ({ ...d, [field]: value })); }

  const dobAge = useDobAgeSync({ dateOfBirth: draft.dob, age: draft.age, isAgeEstimated: draft.ageEstimated });
  useEffect(() => {
    setDraft((d) => ({ ...d, dob: dobAge.dob, age: dobAge.age, ageEstimated: dobAge.isAgeEstimated }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dobAge.dob, dobAge.age, dobAge.isAgeEstimated]);

  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  function validateField(name, value) {
    const messages = {
      firstName: !value.trim() && 'First name is required',
      lastName: !value.trim() && 'Last name is required',
      gender: !value && 'Gender is required',
      location: !value.trim() && 'Location is required',
      phone: fields.isRequired('phone') && !value && 'Phone is required',
      age: value !== '' && (isNaN(+value) || +value < 0 || +value > 150) && 'Age must be between 0 and 150',
      height: (value !== '' && (isNaN(+value) || +value < 0 || +value > 300) && 'Height must be between 0 and 300')
        || (fields.isRequired('height') && value === '' && 'Height is required'),
      weight: (value !== '' && (isNaN(+value) || +value < 0 || +value > 500) && 'Weight must be between 0 and 500')
        || (fields.isRequired('weight') && value === '' && 'Weight is required'),
      nokName: fields.isRequired('nextOfKinName') && !value && 'Next of Kin Name is required',
      allergies: fields.isRequired('allergies') && !value && 'Allergies is required',
      conditions: fields.isRequired('chronicConditions') && !value && 'Chronic Conditions is required',
    };
    setErrors((e) => ({ ...e, [name]: messages[name] || undefined }));
    return !messages[name];
  }

  function handleClear() {
    if (!confirm('Clear all entered information?')) return;
    setErrors({});
    setFormError(null);
    if (isEdit) setEditDraft(patientToDraft(p));
    else clearPersisted();
  }

  async function handleSubmit() {
    const coreFields = { firstName: draft.firstName, lastName: draft.lastName, gender: draft.gender, location: draft.location };
    const configuredFields = {
      ...(fields.isEnabled('phone') && { phone: draft.phone }),
      ...(fields.isEnabled('dobAge') && { age: draft.age }),
      ...(fields.isEnabled('height') && { height: draft.height }),
      ...(fields.isEnabled('weight') && { weight: draft.weight }),
      ...(fields.isEnabled('nextOfKinName') && { nokName: draft.nokName }),
      ...(fields.isEnabled('allergies') && { allergies: draft.allergies }),
      ...(fields.isEnabled('chronicConditions') && { conditions: draft.conditions }),
    };
    const allFields = { ...coreFields, ...configuredFields };
    const results = Object.entries(allFields).map(([name, value]) => validateField(name, value));
    if (fields.isEnabled('dobAge') && fields.isRequired('dobAge') && !draft.dob && !draft.age) {
      setFormError('Date of Birth or Age is required');
      return;
    }
    if (!results.every(Boolean)) {
      setFormError('Please fix the highlighted fields below');
      return;
    }
    setFormError(null);
    setSaving(true);

    const nationalIdComplete = draft.nationalId && draft.nationalId.length === 10;
    const payload = {
      firstName: draft.firstName, lastName: draft.lastName, gender: draft.gender, location: draft.location,
      phoneNumber: fields.isEnabled('phone') ? (draft.phone || null) : null,
      dateOfBirth: fields.isEnabled('dobAge') ? (draft.dob || null) : null,
      age: fields.isEnabled('dobAge') && draft.age ? parseInt(draft.age, 10) : null,
      ageEstimated: draft.ageEstimated,
      // An untouched "GHA-" prefix (0 digits) is discarded, not saved.
      nationalIdNumber: fields.isEnabled('nationalId') && nationalIdComplete ? formatNationalId(draft.nationalId) : null,
      insuranceNumber: fields.isEnabled('insurance') && draft.insurance ? draft.insurance : null,
      height: fields.isEnabled('height') && draft.height !== '' ? parseFloat(draft.height) : null,
      weight: fields.isEnabled('weight') && draft.weight !== '' ? parseFloat(draft.weight) : null,
      nextOfKinName: fields.isEnabled('nextOfKinName') ? (draft.nokName || null) : null,
      nextOfKinContact: fields.isEnabled('nextOfKinContact') ? (draft.nokPhone || null) : null,
      allergies: fields.isEnabled('allergies') ? (draft.allergies || null) : null,
      chronicConditions: fields.isEnabled('chronicConditions') ? (draft.conditions || null) : null,
      version: p.version || 1,
    };
    try {
      if (p.folder_number) {
        await api.put(`/patients/${p.folder_number}`, payload);
        onSaved('patientDetail', { folderNumber: p.folder_number });
      } else {
        const created = await api.post('/patients', payload);
        clearPersisted();
        onSaved('patientDetail', { folderNumber: created.folder_number });
      }
    } catch (err) {
      setFormError(err.message.includes('updated by someone else')
        ? 'This record changed while you were editing. Go back and try again.'
        : err.message);
    } finally {
      setSaving(false);
    }
  }

  const showIdentification = fields.isEnabled('nationalId') || fields.isEnabled('insurance');
  const showPhysical = fields.isEnabled('height') || fields.isEnabled('weight');
  const showNextOfKin = fields.isEnabled('nextOfKinName') || fields.isEnabled('nextOfKinContact');
  const showMedical = fields.isEnabled('allergies') || fields.isEnabled('chronicConditions');

  return (
    <>
      <TopBar
        title={isEdit ? 'Edit Patient' : 'New Patient'}
        subtitle={isEdit ? p.folder_number : 'Register a new record'}
        leading={<BackButton onClick={onBack} />}
      />
      <div className="main-content">
        {isEdit && <Alert variant="info">Folder {p.folder_number} cannot be changed · Version {p.version}</Alert>}
        {!isEdit && <Alert variant="info">Your progress is saved automatically if you close this page by accident.</Alert>}
        <Alert variant="error">{formError}</Alert>

        <Card>
          <CardTitle icon="badge">Personal Information</CardTitle>
          <div className="grid2">
            <TextField label="First Name" required value={draft.firstName}
              onChange={set('firstName')} onBlur={(e) => { set('firstName')(titleCase(e.target.value)); validateField('firstName', e.target.value); }}
              error={errors.firstName} />
            <TextField label="Last Name" required value={draft.lastName}
              onChange={set('lastName')} onBlur={(e) => { set('lastName')(titleCase(e.target.value)); validateField('lastName', e.target.value); }}
              error={errors.lastName} />
          </div>
          {fields.isEnabled('dobAge') && <DobAgeFields sync={dobAge} ageError={errors.age} />}
          <div className="grid2">
            <Select label="Gender" required value={draft.gender} options={GENDER_OPTIONS}
              onChange={(v) => { set('gender')(v); validateField('gender', v); }} error={errors.gender} />
            {fields.isEnabled('phone') && (
              <PhoneField label="Phone" required={fields.isRequired('phone')} value={draft.phone} onChange={set('phone')} />
            )}
          </div>
          <TextField label="Location" required value={draft.location}
            onChange={set('location')} onBlur={(e) => validateField('location', e.target.value)}
            error={errors.location} />
        </Card>

        {showIdentification && (
          <Card>
            <CardTitle icon="fingerprint">Identification</CardTitle>
            <div className="grid2">
              {fields.isEnabled('nationalId') && (
                <NationalIdField value={draft.nationalId} onChange={set('nationalId')} excludeFolderNumber={p.folder_number} required={fields.isRequired('nationalId')} />
              )}
              {fields.isEnabled('insurance') && (
                <InsuranceField value={draft.insurance} onChange={set('insurance')} excludeFolderNumber={p.folder_number} required={fields.isRequired('insurance')} />
              )}
            </div>
          </Card>
        )}

        {showPhysical && (
          <Card>
            <CardTitle icon="straighten">Physical</CardTitle>
            <div className="grid2">
              {fields.isEnabled('height') && (
                <TextField label="Height (cm)" required={fields.isRequired('height')} type="number" value={draft.height}
                  onChange={set('height')} onBlur={(e) => validateField('height', e.target.value)} error={errors.height} />
              )}
              {fields.isEnabled('weight') && (
                <TextField label="Weight (kg)" required={fields.isRequired('weight')} type="number" value={draft.weight}
                  onChange={set('weight')} onBlur={(e) => validateField('weight', e.target.value)} error={errors.weight} />
              )}
            </div>
          </Card>
        )}

        {showNextOfKin && (
          <Card>
            <CardTitle icon="family_restroom">Next of Kin</CardTitle>
            <div className="grid2">
              {fields.isEnabled('nextOfKinName') && (
                <TextField label="Name" required={fields.isRequired('nextOfKinName')} value={draft.nokName}
                  onChange={set('nokName')} onBlur={(e) => { set('nokName')(titleCase(e.target.value)); validateField('nokName', e.target.value); }}
                  error={errors.nokName} />
              )}
              {fields.isEnabled('nextOfKinContact') && (
                <PhoneField label="Contact" required={fields.isRequired('nextOfKinContact')} value={draft.nokPhone} onChange={set('nokPhone')} />
              )}
            </div>
          </Card>
        )}

        {showMedical && (
          <Card>
            <CardTitle icon="medical_information">Medical</CardTitle>
            {fields.isEnabled('allergies') && (
              <TextField label="Allergies" required={fields.isRequired('allergies')} multiline rows={2} value={draft.allergies}
                onChange={set('allergies')} onBlur={(e) => validateField('allergies', e.target.value)} error={errors.allergies} />
            )}
            {fields.isEnabled('chronicConditions') && (
              <TextField label="Chronic Conditions" required={fields.isRequired('chronicConditions')} multiline rows={2} value={draft.conditions}
                onChange={set('conditions')} onBlur={(e) => validateField('conditions', e.target.value)} error={errors.conditions} />
            )}
          </Card>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="filled" fullWidth icon={isEdit ? 'save' : 'check_circle'} loading={saving} onClick={handleSubmit}>
            {isEdit ? 'Update Patient' : 'Register Patient'}
          </Button>
          <Button variant="outlined" icon="backspace" onClick={handleClear}>Clear</Button>
        </div>
      </div>
    </>
  );
}
