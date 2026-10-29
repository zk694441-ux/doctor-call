import { Checkbox, message, Card, Input, Select } from 'antd';
import { useEffect, useState } from 'react';
import useAuthCheck from '../../redux/hooks/useAuthCheck';
import { visitReasonOptions } from '../../constant/global';
import '../../components/Appointment/AppointmentFlow.css';

const { TextArea } = Input;

const PersonalInformation = ({ handleChange, selectValue, setPatientId = () => {} }) => {
  const { firstName, lastName, email, phone, reasonForVisit, description, address, problemType } = selectValue;
  const [checked, setChecked] = useState(false);
  const { data } = useAuthCheck();

  const onFieldChange = (name, value) => {
    handleChange({ target: { name, value } });
  };

  const handleCheckboxChange = (e) => {
    const isChecked = e.target.checked;
    setChecked(isChecked);

    if (isChecked) {
      if (data?.id) {
        setPatientId(data.id);
      }
      if (data?.firstName) onFieldChange('firstName', data.firstName);
      if (data?.lastName) onFieldChange('lastName', data.lastName);
      if (data?.email) onFieldChange('email', data.email);
      if (data?.mobile) onFieldChange('phone', data.mobile);
      if (data?.address) onFieldChange('address', data.address);
      message.success('Account profile details populated.');
    }
  };

  return (
    <div className="appointment-step appointment-step--patient" style={{ marginTop: '1rem' }}>
      <p className="appointment-step__title">Patient Contact &amp; Consultation Details</p>
      <p className="appointment-step__subtitle">Please enter the details of the patient who will attend the consultation.</p>

      {data && (
        <Card className="patient-form-card mb-3" size="small" style={{ background: '#f8f9fa' }}>
          <Checkbox checked={checked} onChange={handleCheckboxChange}>
            <strong>Auto-fill with my account details ({data?.firstName} {data?.lastName} - {data?.email})</strong>
          </Checkbox>
        </Card>
      )}

      <Card className="patient-form-card mb-3" size="small">
        <p className="patient-form-card__title">Personal Details</p>
        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label">First Name <span className="text-danger">*</span></label>
            <Input
              placeholder="e.g. John"
              name="firstName"
              value={firstName || ''}
              onChange={handleChange}
              size="large"
            />
          </div>
          <div className="col-md-6">
            <label className="form-label">Last Name <span className="text-danger">*</span></label>
            <Input
              placeholder="e.g. Doe"
              name="lastName"
              value={lastName || ''}
              onChange={handleChange}
              size="large"
            />
          </div>
          <div className="col-md-6">
            <label className="form-label">Email Address <span className="text-danger">*</span></label>
            <Input
              type="email"
              placeholder="name@example.com"
              name="email"
              value={email || ''}
              onChange={handleChange}
              size="large"
            />
          </div>
          <div className="col-md-6">
            <label className="form-label">Phone Number <span className="text-danger">*</span></label>
            <Input
              placeholder="+91 9876543210"
              name="phone"
              value={phone || ''}
              onChange={handleChange}
              size="large"
            />
          </div>
          <div className="col-12">
            <label className="form-label">Residential Address (optional)</label>
            <Input
              placeholder="City, State, Country"
              name="address"
              value={address || ''}
              onChange={handleChange}
              size="large"
            />
          </div>
        </div>
      </Card>

      <Card className="patient-form-card" size="small">
        <p className="patient-form-card__title">Consultation Details</p>
        <div className="row g-3">
          <div className="col-12">
            <label className="form-label">Reason for Visit / Symptoms</label>
            <TextArea
              rows={3}
              placeholder="Brief description of the health reason or symptoms (e.g., Routine Checkup, Follow up, Consultation)..."
              name="reasonForVisit"
              value={reasonForVisit || ''}
              onChange={handleChange}
              size="large"
            />
          </div>
          <div className="col-12">
            <label className="form-label">Additional Medical Notes (optional)</label>
            <TextArea
              rows={2}
              placeholder="Any current medications, allergies, or prior health history..."
              name="description"
              value={description || ''}
              onChange={handleChange}
              size="large"
            />
          </div>
        </div>
      </Card>
    </div>
  );
};

export default PersonalInformation;
