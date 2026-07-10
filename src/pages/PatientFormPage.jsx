import { useEffect, useState } from 'react';
import { TopBar, BackButton, Card, CardTitle, TextField, Select, Button, Alert } from '../components/ui';
import { DobAgeFields } from '../components/patients/DobAgeFields';
import { useDobAgeSync } from '../hooks/useDobAgeSync';
import { useApiQuery } from '../hooks/useApiQuery';
import { useNavigation } from '../context/NavigationContext';
import { api } from '../lib/api';
import { titleCase } from '../lib/format';

const GENDER_OPTIONS = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Other', label: 'Other' },
];

export function PatientFormPage() {
  const { params, navigate, back } = useNavigation();
  const isEdit = !!params.folderNumber;
  const existing = useApiQuery(isEdit ? `/patients/${params.folderNumber}` : null);

  // Wait for the existing record to load before mounting the form body so
  // every field initializes from real data exactly once (no flash of an
  // empty form followed by a refill).
  if (isEdit && existing.loading) return (<><TopBar title="Edit Patient" leading={<BackButton onClick={back} />} /></>);
  if (isEdit && existing.error) return (<><TopBar title="Edit Patient" leading={<BackButton onClick={back} />} /><div className="main-content"><Alert variant="error">{existing.error}</Alert></div></>);

  return <PatientFormBody isEdit={isEdit} initial={existing.data} onBack={back} onSaved={navigate} />;
}

function PatientFormBody({ isEdit, initial, onBack, onSaved }) {
  const p = initial || {};
  const [firstName, setFirstName] = useState(p.first_name ? titleCase(p.first_name) : '');
  const [lastName, setLastName] = useState(p.last_name ? titleCase(p.last_name) : '');
  const [gender, setGender] = useState(p.gender || '');
  const [phone, setPhone] = useState(p.phone_number || '');
  const [nokPhone, setNokPhone] = useState(p.next_of_kin_contact || '');
  const [location, setLocation] = useState(p.location || '');
  const [nationalId, setNationalId] = useState(p.national_id_number || '');
  const [insurance, setInsurance] = useState(p.insurance_number || '');
  const [height, setHeight] = useState(p.height ?? '');
  const [weight, setWeight] = useState(p.weight ?? '');
  const [nokName, setNokName] = useState(p.next_of_kin_name ? titleCase(p.next_of_kin_name) : '');
  const [allergies, setAllergies] = useState(p.allergies || '');
  const [conditions, setConditions] = useState(p.chronic_conditions || '');
  const dobAge = useDobAgeSync(p);

  const [errors, setErrors] = useState({});
  const [duplicateNotice, setDuplicateNotice] = useState(null);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  function validateField(name, value) {
    const messages = {
      firstName: !value.trim() && 'First name is required',
      lastName: !value.trim() && 'Last name is required',
      gender: !value && 'Gender is required',
      location: !value.trim() && 'Location is required',
      phone: value && !/^0\d{9}$/.test(value.replace(/\D/g, '')) && 'Enter a 10-digit number starting with 0',
      age: value !== '' && (isNaN(+value) || +value < 0 || +value > 150) && 'Age must be between 0 and 150',
      height: value !== '' && (isNaN(+value) || +value < 0 || +value > 300) && 'Height must be between 0 and 300',
      weight: value !== '' && (isNaN(+value) || +value < 0 || +value > 500) && 'Weight must be between 0 and 500',
    };
    setErrors((e) => ({ ...e, [name]: messages[name] || undefined }));
    return !messages[name];
  }

  // Debounced duplicate-ID lookup, same UX as before but as a plain effect.
  useEffect(() => {
    const value = nationalId || insurance;
    if (!value) { setDuplicateNotice(null); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await api.post('/patients/check-unique', {
          nationalIdNumber: nationalId || null,
          insuranceNumber: insurance || null,
          excludeFolderNumber: p.folder_number,
        });
        const hit = res.nationalId?.exists ? res.nationalId : res.insurance?.exists ? res.insurance : null;
        setDuplicateNotice(hit ? hit.patient : null);
      } catch { /* non-blocking */ }
    }, 400);
    return () => clearTimeout(timer);
  }, [nationalId, insurance, p.folder_number]);

  async function handleSubmit() {
    const fields = { firstName, lastName, gender, location, phone, age: dobAge.age, height, weight };
    const results = Object.entries(fields).map(([name, value]) => validateField(name, value));
    if (!results.every(Boolean)) {
      setFormError('Please fix the highlighted fields below');
      return;
    }
    setFormError(null);
    setSaving(true);
    const payload = {
      firstName, lastName, gender, location,
      phoneNumber: phone || null,
      dateOfBirth: dobAge.dob || null,
      age: dobAge.age ? parseInt(dobAge.age, 10) : null,
      ageEstimated: dobAge.isAgeEstimated,
      nationalIdNumber: nationalId || null,
      insuranceNumber: insurance || null,
      height: height !== '' ? parseFloat(height) : null,
      weight: weight !== '' ? parseFloat(weight) : null,
      nextOfKinName: nokName || null,
      nextOfKinContact: nokPhone || null,
      allergies: allergies || null,
      chronicConditions: conditions || null,
      version: p.version || 1,
    };
    try {
      if (p.folder_number) {
        await api.put(`/patients/${p.folder_number}`, payload);
        onSaved('patientDetail', { folderNumber: p.folder_number });
      } else {
        const created = await api.post('/patients', payload);
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
        <Alert variant="error">{formError}</Alert>

        <Card>
          <CardTitle icon="badge">Personal Information</CardTitle>
          <div className="grid2">
            <TextField label="First Name" required value={firstName}
              onChange={setFirstName} onBlur={(e) => { setFirstName(titleCase(e.target.value)); validateField('firstName', e.target.value); }}
              error={errors.firstName} />
            <TextField label="Last Name" required value={lastName}
              onChange={setLastName} onBlur={(e) => { setLastName(titleCase(e.target.value)); validateField('lastName', e.target.value); }}
              error={errors.lastName} />
          </div>
          <DobAgeFields sync={dobAge} ageError={errors.age} />
          <div className="grid2">
            <Select label="Gender" required value={gender} options={GENDER_OPTIONS}
              onChange={(v) => { setGender(v); validateField('gender', v); }} error={errors.gender} />
            <TextField label="Phone" type="tel" placeholder="0201234567" value={phone}
              onChange={setPhone} onBlur={(e) => validateField('phone', e.target.value)}
              error={errors.phone} valid={!!phone && !errors.phone} />
          </div>
          <TextField label="Location" required value={location}
            onChange={setLocation} onBlur={(e) => validateField('location', e.target.value)}
            error={errors.location} />
        </Card>

        <Card>
          <CardTitle icon="fingerprint">Identification</CardTitle>
          <div className="grid2">
            <TextField label="National ID" value={nationalId} onChange={setNationalId} />
            <TextField label="Insurance Number" value={insurance} onChange={setInsurance} />
          </div>
          {duplicateNotice && (
            <Alert variant="warning">
              Already registered: {titleCase(duplicateNotice.first_name)} {titleCase(duplicateNotice.last_name)} ({duplicateNotice.folder_number})
            </Alert>
          )}
        </Card>

        <Card>
          <CardTitle icon="straighten">Physical</CardTitle>
          <div className="grid2">
            <TextField label="Height (cm)" type="number" value={height}
              onChange={setHeight} onBlur={(e) => validateField('height', e.target.value)} error={errors.height} />
            <TextField label="Weight (kg)" type="number" value={weight}
              onChange={setWeight} onBlur={(e) => validateField('weight', e.target.value)} error={errors.weight} />
          </div>
        </Card>

        <Card>
          <CardTitle icon="family_restroom">Next of Kin</CardTitle>
          <div className="grid2">
            <TextField label="Name" value={nokName} onChange={setNokName} onBlur={(e) => setNokName(titleCase(e.target.value))} />
            <TextField label="Contact" type="tel" value={nokPhone} onChange={setNokPhone} />
          </div>
        </Card>

        <Card>
          <CardTitle icon="medical_information">Medical</CardTitle>
          <TextField label="Allergies" multiline rows={2} value={allergies} onChange={setAllergies} />
          <TextField label="Chronic Conditions" multiline rows={2} value={conditions} onChange={setConditions} />
        </Card>

        <Button variant="filled" fullWidth icon={isEdit ? 'save' : 'check_circle'} loading={saving} onClick={handleSubmit}>
          {isEdit ? 'Update Patient' : 'Register Patient'}
        </Button>
      </div>
    </>
  );
}
