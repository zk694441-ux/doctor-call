import React, { useEffect, useState } from 'react';
import Footer from '../Shared/Footer/Footer';
import Header from '../Shared/Header/Header';
import CheckoutPage from '../Booking/BookingCheckout/CheckoutPage';
import PersonalInformation from '../Booking/PersonalInformation';
import { Button, Steps, message, Modal, Divider } from 'antd';
import moment from 'moment';
import SelectApppointment from './SelectApppointment';
import SelectDoctor from './SelectDoctor';
import useAuthCheck from '../../redux/hooks/useAuthCheck';
import { useCreateAppointmentMutation } from '../../redux/api/appointmentApi';
import { useDispatch } from 'react-redux';
import { addInvoice } from '../../redux/feature/invoiceSlice';
import { useNavigate } from 'react-router-dom';
import { visitReasonOptions } from '../../constant/global';
import RazorpayCheckout from '../Payment/RazorpayCheckout';
import './AppointmentFlow.css';

const initialValue = {
  paymentMethod: 'razorpay',
  paymentType: 'online',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  reasonForVisit: 'General Medical Consultation',
  problemType: '',
  description: '',
  address: '',
};

const AppointmentPage = () => {
  const dispatch = useDispatch();
  const { data: loggedInUser, role } = useAuthCheck();
  const [current, setCurrent] = useState(0);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectTime, setSelectTime] = useState('');
  const [isCheck, setIsChecked] = useState(true);
  const [selectValue, setSelectValue] = useState(initialValue);
  const [patientId, setPatientId] = useState('');
  const [createdAppointment, setCreatedAppointment] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const navigate = useNavigate();

  const [createAppointment, { data: appointmentData, isError, isSuccess, isLoading, error }] =
    useCreateAppointmentMutation();

  // Auto-populate patient details if logged in
  useEffect(() => {
    if (loggedInUser) {
      setSelectValue((prev) => ({
        ...prev,
        firstName: prev.firstName || loggedInUser.firstName || '',
        lastName: prev.lastName || loggedInUser.lastName || '',
        email: prev.email || loggedInUser.email || '',
        phone: prev.phone || loggedInUser.mobile || '',
        address: prev.address || loggedInUser.address || '',
        reasonForVisit: prev.reasonForVisit || 'General Medical Consultation',
      }));
      if (loggedInUser.id) {
        setPatientId(loggedInUser.id);
      }
    }
  }, [loggedInUser]);

  const handleChange = (e) => setSelectValue({ ...selectValue, [e.target.name]: e.target.value });

  const next = () => {
    if (current === 0) {
      if (!selectedDoctor) {
        message.warning('Please click to select a doctor first.');
        return;
      }
      setCurrent(1);
    } else if (current === 1) {
      if (!selectedDate) {
        message.warning('Please pick a date for your appointment.');
        return;
      }
      if (!selectTime) {
        message.warning('Please select an available time slot.');
        return;
      }
      setCurrent(2);
    } else if (current === 2) {
      if (!selectValue.firstName?.trim() || !selectValue.lastName?.trim()) {
        message.warning('Please enter patient first and last name.');
        return;
      }
      if (!selectValue.email?.trim()) {
        message.warning('Please enter contact email address.');
        return;
      }
      if (!selectValue.phone?.trim()) {
        message.warning('Please enter contact phone number.');
        return;
      }
      if (!selectValue.reasonForVisit?.trim()) {
        setSelectValue((prev) => ({ ...prev, reasonForVisit: 'General Medical Consultation' }));
      }
      setCurrent(3);
    }
  };

  const prev = () => setCurrent(current - 1);

  const handleConfirmSchedule = () => {
    if (!selectedDoctor) {
      message.warning('Please select a doctor.');
      setCurrent(0);
      return;
    }
    if (!selectedDate || !selectTime) {
      message.warning('Please pick an appointment date and time.');
      setCurrent(1);
      return;
    }
    if (!selectValue.firstName?.trim() || !selectValue.email?.trim() || !selectValue.phone?.trim()) {
      message.warning('Please fill in required patient contact details.');
      setCurrent(2);
      return;
    }
    if (!isCheck) {
      message.warning('Please accept the Cancellation & Refund policy to proceed.');
      return;
    }

    const isPatientSession = role === 'patient' && loggedInUser?.id;

    const obj = {
      patientInfo: {
        firstName: selectValue.firstName,
        lastName: selectValue.lastName,
        email: selectValue.email,
        phone: selectValue.phone,
        patientId: isPatientSession ? loggedInUser.id : undefined,
        scheduleDate: selectedDate,
        scheduleTime: selectTime,
        reasonForVisit: [
          selectValue.problemType && visitReasonOptions.find((o) => o.value === selectValue.problemType)?.label,
          selectValue.reasonForVisit,
        ]
          .filter(Boolean)
          .join(' — ') || selectValue.reasonForVisit || 'General Medical Consultation',
        description: selectValue.description || undefined,
        address: selectValue.address || undefined,
        doctorId: selectedDoctor.id,
      },
      payment: {
        paymentType: selectValue.paymentType || 'online',
        paymentMethod: selectValue.paymentMethod || 'razorpay',
      },
    };

    createAppointment(obj);
  };

  useEffect(() => {
    if (isSuccess && appointmentData?.id) {
      dispatch(addInvoice({ ...appointmentData }));
      const isCash = selectValue.paymentType === 'cash';

      if (isCash) {
        message.success('Appointment scheduled successfully! Please pay at the clinic.');
        navigate(`/booking/success/${appointmentData.id}`);
      } else {
        // Online payment with Razorpay
        setCreatedAppointment(appointmentData);
        setShowPaymentModal(true);
      }
    }
    if (isError) {
      message.error(error?.data?.message || 'Failed to schedule appointment. Please try again.');
    }
  }, [isSuccess, isError, appointmentData, error, dispatch, navigate]);

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    navigate(`/booking/success/${createdAppointment?.id}`);
  };

  const handlePaymentFailure = () => {
    message.warning('Payment incomplete. Your slot is held for 15 minutes.');
  };

  const handleDateChange = (date) => setSelectedDate(moment(date).format('YYYY-MM-DD'));

  const steps = [
    {
      title: 'Select Doctor',
      content: (
        <SelectDoctor selectedDoctor={selectedDoctor} onSelect={setSelectedDoctor} />
      ),
    },
    {
      title: 'Date & Time',
      content: (
        <SelectApppointment
          handleDateChange={handleDateChange}
          selectedDate={selectedDate}
          selectTime={selectTime}
          setSelectTime={setSelectTime}
          selectedDoctor={selectedDoctor}
        />
      ),
    },
    {
      title: 'Patient Information',
      content: (
        <PersonalInformation
          handleChange={handleChange}
          selectValue={selectValue}
          setPatientId={setPatientId}
        />
      ),
    },
    {
      title: 'Payment & Confirmation',
      content: (
        <CheckoutPage
          handleChange={handleChange}
          selectValue={selectValue}
          isCheck={isCheck}
          setIsChecked={setIsChecked}
          data={selectedDoctor ? { ...selectedDoctor, price: selectedDoctor.price || 60 } : false}
          selectedDate={selectedDate}
          selectTime={selectTime}
        />
      ),
    },
  ];

  const items = steps.map((item) => ({ key: item.title, title: item.title }));

  return (
    <>
      <Header />
      <div className="appointment-page" style={{ marginTop: '7rem', marginBottom: '8rem' }}>
        <div className="container container-wrap">
          <Steps current={current} items={items} responsive />
          <div className="appointment-step">{steps[current].content}</div>
          <div className="appointment-actions" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, borderTop: '1px solid #e9ecef', paddingTop: 16 }}>
            <div>
              {current > 0 && (
                <Button type="default" size="large" onClick={prev}>
                  Previous
                </Button>
              )}
            </div>
            <div>
              {current < steps.length - 1 && (
                <Button
                  type="primary"
                  size="large"
                  onClick={next}
                  style={{ background: '#0d6efd', borderColor: '#0d6efd', minWidth: 130 }}
                >
                  Next Step →
                </Button>
              )}
              {current === steps.length - 1 && (
                <Button
                  type="primary"
                  size="large"
                  loading={isLoading}
                  onClick={handleConfirmSchedule}
                  style={{
                    background: '#198754',
                    borderColor: '#198754',
                    minWidth: 220,
                    fontWeight: 600,
                    fontSize: 16,
                  }}
                >
                  {selectValue.paymentType === 'cash' ? 'Confirm Appointment (Pay at Clinic)' : 'Confirm & Proceed to Payment'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Razorpay Online Consultation Payment Modal */}
      <Modal
        open={showPaymentModal}
        title="Complete Consultation Payment"
        onCancel={() => {
          setShowPaymentModal(false);
          message.info('Payment window closed. Your slot is reserved for 15 minutes.');
        }}
        footer={null}
        centered
        width={520}
      >
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <p style={{ fontSize: '15px', color: '#495057', marginBottom: 6 }}>
            Tracking ID: <strong>{createdAppointment?.trackingId}</strong>
          </p>
          <p style={{ fontSize: '13px', color: '#6c757d' }}>
            Doctor: <strong>Dr. {selectedDoctor?.firstName} {selectedDoctor?.lastName}</strong> ({selectedDate} at {selectTime})
          </p>
          <Divider style={{ margin: '12px 0' }} />
          {createdAppointment?.id && (
            <RazorpayCheckout
              appointmentId={createdAppointment.id}
              appointmentData={{
                patientName: `${selectValue.firstName} ${selectValue.lastName}`,
                email: selectValue.email,
                phone: selectValue.phone,
                doctorName: `${selectedDoctor?.firstName || ''} ${selectedDoctor?.lastName || ''}`,
              }}
              onSuccess={handlePaymentSuccess}
              onFailure={handlePaymentFailure}
            />
          )}
        </div>
      </Modal>

      <Footer />
    </>
  );
};

export default AppointmentPage;
