import { useEffect, useState } from 'react';
import { TopBar, BackButton, Card, CardTitle, TextField, Select, Button, Alert } from '../components/ui';
import { DobAgeFields } from '../components/patients/DobAgeFields';
import { PhoneField } from '../components/patients/PhoneField';
import { InsuranceField } from '../components/patients/InsuranceField';
import { NationalIdField, formatNationalId } from '../components/patients/NationalIdField';
import { useDobAgeSync } from '../hooks/useDobAgeSync';
import { usePersistentDraft } from '../hooks/usePersistentDraft';
import { useApiQuery } from '../hooks/useApiQuery';
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

  // Wait for the existing record to load before mounting the form body so
  // every field initializes from real data exactly once (no flash of an
  // empty form followed by a refill).
  if (isEdit && existing.loading) return (<><TopBar title="Edit Patient" leading={<BackButton onClick={back} />} /></>);
  if (isEdit && existing.error) return (<><TopBar title="Edit Patient" leading={<BackButton onClick={back} />} /><div className="main-content"><Alert variant="error">{existing.error}</Alert></div></>);

  return <PatientFormBody isEdit={isEdit} initial={existing.data} onBack={back} onSaved={replace} />;
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

function PatientFormBody({ isEdit, initial, onBack, onSaved }) {
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
      age: value !== '' && (isNaN(+value) || +value < 0 || +value > 150) && 'Age must be between 0 and 150',
      height: value !== '' && (isNaN(+value) || +value < 0 || +value > 300) && 'Height must be between 0 and 300',
      weight: value !== '' && (isNaN(+value) || +value < 0 || +value > 500) && 'Weight must be between 0 and 500',
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
    const fields = { firstName: draft.firstName, lastName: draft.lastName, gender: draft.gender, location: draft.location, age: draft.age, height: draft.height, weight: draft.weight };
    const results = Object.entries(fields).map(([name, value]) => validateField(name, value));
    if (!results.every(Boolean)) {
      setFormError('Please fix the highlighted fields below');
      return;
    }
    setFormError(null);
    setSaving(true);

    const nationalIdComplete = draft.nationalId && draft.nationalId.length === 10;
    const payload = {
      firstName: draft.firstName, lastName: draft.lastName, gender: draft.gender, location: draft.location,
      phoneNumber: draft.phone || null,
      dateOfBirth: draft.dob || null,
      age: draft.age ? parseInt(draft.age, 10) : null,
      ageEstimated: draft.ageEstimated,
      // An untouched "GHA-" prefix (0 digits) is discarded, not saved.
      nationalIdNumber: nationalIdComplete ? formatNationalId(draft.nationalId) : null,
      insuranceNumber: draft.insurance ? draft.insurance : null,
      height: draft.height !== '' ? parseFloat(draft.height) : null,
      weight: draft.weight !== '' ? parseFloat(draft.weight) : null,
      nextOfKinName: draft.nokName || null,
      nextOfKinContact: draft.nokPhone || null,
      allergies: draft.allergies || null,
      chronicConditions: draft.conditions || null,
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
          <DobAgeFields sync={dobAge} ageError={errors.age} />
          <div className="grid2">
            <Select label="Gender" required value={draft.gender} options={GENDER_OPTIONS}
              onChange={(v) => { set('gender')(v); validateField('gender', v); }} error={errors.gender} />
            <PhoneField label="Phone" value={draft.phone} onChange={set('phone')} />
          </div>
          <TextField label="Location" required value={draft.location}
            onChange={set('location')} onBlur={(e) => validateField('location', e.target.value)}
            error={errors.location} />
        </Card>

        <Card>
          <CardTitle icon="fingerprint">Identification</CardTitle>
          <div className="grid2">
            <NationalIdField value={draft.nationalId} onChange={set('nationalId')} excludeFolderNumber={p.folder_number} />
            <InsuranceField value={draft.insurance} onChange={set('insurance')} excludeFolderNumber={p.folder_number} />
          </div>
        </Card>

        <Card>
          <CardTitle icon="straighten">Physical</CardTitle>
          <div className="grid2">
            <TextField label="Height (cm)" type="number" value={draft.height}
              onChange={set('height')} onBlur={(e) => validateField('height', e.target.value)} error={errors.height} />
            <TextField label="Weight (kg)" type="number" value={draft.weight}
              onChange={set('weight')} onBlur={(e) => validateField('weight', e.target.value)} error={errors.weight} />
          </div>
        </Card>

        <Card>
          <CardTitle icon="family_restroom">Next of Kin</CardTitle>
          <div className="grid2">
            <TextField label="Name" value={draft.nokName} onChange={set('nokName')} onBlur={(e) => set('nokName')(titleCase(e.target.value))} />
            <PhoneField label="Contact" value={draft.nokPhone} onChange={set('nokPhone')} />
          </div>
        </Card>

        <Card>
          <CardTitle icon="medical_information">Medical</CardTitle>
          <TextField label="Allergies" multiline rows={2} value={draft.allergies} onChange={set('allergies')} />
          <TextField label="Chronic Conditions" multiline rows={2} value={draft.conditions} onChange={set('conditions')} />
        </Card>

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
