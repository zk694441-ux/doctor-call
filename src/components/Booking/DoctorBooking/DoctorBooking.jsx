import React, { useEffect, useState } from 'react';
import Footer from '../../Shared/Footer/Footer';
import img from '../../../images/doc/doctor 3.jpg';
import './index.css';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Empty, Button, message, Steps, Modal, Divider, Spin } from 'antd';
import { useGetDoctorQuery } from '../../../redux/api/doctorApi';
import { FaArchway } from "react-icons/fa";
import { useGetAppointmentTimeQuery } from '../../../redux/api/timeSlotApi';
import moment from 'moment';
import SelectDateAndTime from '../SelectDateAndTime';
import PersonalInformation from '../PersonalInformation';
import CheckoutPage from '../BookingCheckout/CheckoutPage';
import { useCreateAppointmentMutation } from '../../../redux/api/appointmentApi';
import { useDispatch } from 'react-redux';
import { addInvoice } from '../../../redux/feature/invoiceSlice';
import Header from '../../Shared/Header/Header';
import useAuthCheck from '../../../redux/hooks/useAuthCheck';
import RazorpayCheckout from '../../Payment/RazorpayCheckout';

const defaultFallbackSlots = [
    '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
    '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM', '06:00 PM'
];

const DoctorBooking = () => {
    const dispatch = useDispatch();
    const { data: loggedInUser, role } = useAuthCheck();
    const { doctorId } = useParams();
    const navigation = useNavigate();

    const [current, setCurrent] = useState(0);
    const [selectedDate, setSelectedDate] = useState('');
    const [selectDay, setSelecDay] = useState('');
    const [selectTime, setSelectTime] = useState('');
    const [isCheck, setIsChecked] = useState(true);
    const [patientId, setPatientId] = useState('');
    const [createdAppointment, setCreatedAppointment] = useState(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);

    const [selectValue, setSelectValue] = useState({
        paymentMethod: 'razorpay',
        paymentType: 'online',
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        reasonForVisit: 'General Medical Consultation',
        description: '',
        address: '',
    });

    const { data: doctorData, isLoading: doctorLoading, isError: doctorError } = useGetDoctorQuery(doctorId);
    const { data: rawTimeSlots, refetch, isLoading: slotsLoading } = useGetAppointmentTimeQuery(
        { day: selectDay, id: doctorId },
        { skip: !selectDay }
    );

    const [createAppointment, {
        data: appointmentData,
        isSuccess: createIsSuccess,
        isError: createIsError,
        error: createError,
        isLoading: createIsLoading
    }] = useCreateAppointmentMutation();

    // Auto-populate user details if logged in
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

    const handleChange = (e) => {
        setSelectValue({ ...selectValue, [e.target.name]: e.target.value });
    };

    const handleDateChange = (_date, dateString) => {
        if (!dateString) {
            setSelectedDate('');
            setSelecDay('');
            setSelectTime('');
            return;
        }
        setSelectedDate(dateString);
        setSelecDay(moment(dateString).format('dddd').toLowerCase());
        setSelectTime('');
        refetch();
    };

    // Allow booking starting today up to 60 days in advance
    const disabledDateTime = (currentDate) => {
        return currentDate && (
            currentDate < moment().startOf('day') ||
            currentDate > moment().add(60, 'days').endOf('day')
        );
    };

    const handleSelectTime = (timeStr) => {
        setSelectTime(timeStr);
    };

    // Step navigation with clear user guidance
    const handleNext = () => {
        if (current === 0) {
            if (!selectedDate) {
                message.warning('Please click on the calendar to select a consultation date.');
                return;
            }
            if (!selectTime) {
                message.warning('Please click to select an available time slot.');
                return;
            }
            setCurrent(1);
        } else if (current === 1) {
            if (!selectValue.firstName?.trim()) {
                message.warning('Please enter patient first name.');
                return;
            }
            if (!selectValue.lastName?.trim()) {
                message.warning('Please enter patient last name.');
                return;
            }
            if (!selectValue.email?.trim()) {
                message.warning('Please enter a valid email address.');
                return;
            }
            if (!selectValue.phone?.trim()) {
                message.warning('Please enter a contact phone number.');
                return;
            }
            if (!selectValue.reasonForVisit?.trim()) {
                setSelectValue((prev) => ({ ...prev, reasonForVisit: 'General Medical Consultation' }));
            }
            setCurrent(2);
        }
    };

    const handlePrev = () => {
        setCurrent((prev) => prev - 1);
    };

    const handleConfirmSchedule = () => {
        if (!selectedDate || !selectTime) {
            message.warning('Please pick an appointment date and time slot first.');
            setCurrent(0);
            return;
        }
        if (!selectValue.firstName?.trim() || !selectValue.email?.trim() || !selectValue.phone?.trim()) {
            message.warning('Please fill in required patient contact details.');
            setCurrent(1);
            return;
        }
        if (!isCheck) {
            message.warning('Please accept the Cancellation & Refund policy to proceed.');
            return;
        }

        const payload = {
            patientInfo: {
                firstName: selectValue.firstName,
                lastName: selectValue.lastName,
                email: selectValue.email,
                phone: selectValue.phone,
                scheduleDate: selectedDate,
                scheduleTime: selectTime,
                doctorId: doctorId,
                patientId: role !== '' && role === 'patient' ? (patientId || loggedInUser?.id) : undefined,
                reasonForVisit: selectValue.reasonForVisit || 'General Consultation',
                description: selectValue.description || '',
                address: selectValue.address || '',
            },
            payment: {
                paymentType: selectValue.paymentType || 'online',
                paymentMethod: selectValue.paymentMethod || 'razorpay',
            }
        };

        createAppointment(payload);
    };

    useEffect(() => {
        if (createIsSuccess && appointmentData) {
            dispatch(addInvoice({ ...appointmentData }));
            const isCash = selectValue.paymentType === 'cash';
            if (isCash) {
                message.success("Successfully scheduled! Please pay consultation fee at the clinic.");
                navigation(`/booking/success/${appointmentData.id}`);
            } else {
                setCreatedAppointment(appointmentData);
                setShowPaymentModal(true);
            }
        }
        if (createIsError) {
            message.error(createError?.data?.message || 'Failed to schedule appointment. Please try again.');
        }
    }, [createIsSuccess, createIsError]);

    const handlePaymentSuccess = () => {
        setShowPaymentModal(false);
        const apptId = createdAppointment?.id;
        navigation(`/booking/success/${apptId}`);
    };

    const handlePaymentFailure = () => {
        message.warning('Payment incomplete. Your slot is held for 15 minutes.');
    };

    // Render slots list
    let dContent = null;
    if (slotsLoading) {
        dContent = <div className="text-center py-4"><Spin tip="Loading schedule..." /></div>;
    } else {
        const slotsToDisplay = (rawTimeSlots && rawTimeSlots.length > 0)
            ? rawTimeSlots.map(s => s?.slot?.time || s?.time).filter(Boolean)
            : defaultFallbackSlots;

        dContent = (
            <div className="row g-2 justify-content-start" style={{ marginTop: 10 }}>
                {slotsToDisplay.map((slotTimeStr, idx) => {
                    const isSelected = slotTimeStr === selectTime;
                    return (
                        <div className="col-auto" key={idx}>
                            <Button
                                type={isSelected ? "primary" : "default"}
                                shape="round"
                                size="large"
                                style={{
                                    minWidth: 105,
                                    fontWeight: isSelected ? 600 : 400,
                                    borderColor: isSelected ? '#0d6efd' : '#dee2e6'
                                }}
                                onClick={() => handleSelectTime(slotTimeStr)}
                            >
                                {slotTimeStr}
                            </Button>
                        </div>
                    );
                })}
            </div>
        );
    }

    let doctorCardContent = null;
    if (doctorLoading) doctorCardContent = <div>Loading doctor profile...</div>;
    if (!doctorLoading && doctorError) doctorCardContent = <div>Unable to load doctor profile.</div>;
    if (!doctorLoading && doctorData) {
        doctorCardContent = (
            <div className="booking-doc-img my-3 mb-3 rounded" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <Link to={`/doctors/${doctorData?.id}`}>
                    <img src={doctorData?.img || img} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />
                </Link>
                <div className='text-start'>
                    <Link to={`/doctors/${doctorData?.id}`} style={{ textDecoration: 'none', fontWeight: 600, fontSize: '1.1rem' }}>
                        Dr. {doctorData?.firstName} {doctorData?.lastName}
                    </Link>
                    <p className="form-text mb-0" style={{ color: '#6c757d' }}>
                        <FaArchway style={{ marginRight: 6 }} />
                        {doctorData?.specialization || 'Specialist'}, {doctorData?.experienceHospitalName || 'Clinic'}
                    </p>
                </div>
            </div>
        );
    }

    const steps = [
        {
            title: '1. Select Schedule',
            content: (
                <SelectDateAndTime
                    content={doctorCardContent}
                    handleDateChange={handleDateChange}
                    disabledDateTime={disabledDateTime}
                    selectedDate={selectedDate}
                    dContent={dContent}
                    selectTime={selectTime}
                />
            )
        },
        {
            title: '2. Patient Details',
            content: (
                <PersonalInformation
                    handleChange={handleChange}
                    selectValue={selectValue}
                    setPatientId={setPatientId}
                />
            )
        },
        {
            title: '3. Payment & Confirmation',
            content: (
                <CheckoutPage
                    handleChange={handleChange}
                    selectValue={selectValue}
                    isCheck={isCheck}
                    setIsChecked={setIsChecked}
                    data={doctorData}
                    selectedDate={selectedDate}
                    selectTime={selectTime}
                />
            )
        },
    ];

    const stepItems = steps.map((item) => ({
        key: item.title,
        title: item.title,
    }));

    return (
        <>
            <Header />
            <div className="container" style={{ marginBottom: '10rem', marginTop: '7rem' }}>
                <Steps current={current} items={stepItems} responsive />
                <div className='mb-4 mt-3 mx-2'>{steps[current].content}</div>

                <div className='d-flex justify-content-between align-items-center mx-2 mt-4' style={{ borderTop: '1px solid #e9ecef', paddingTop: 16 }}>
                    <div>
                        {current > 0 && (
                            <Button size="large" onClick={handlePrev}>
                                Previous
                            </Button>
                        )}
                    </div>
                    <div>
                        {current < steps.length - 1 && (
                            <Button
                                type="primary"
                                size="large"
                                onClick={handleNext}
                                style={{ background: '#0d6efd', borderColor: '#0d6efd', minWidth: 130 }}
                            >
                                Next Step →
                            </Button>
                        )}

                        {current === steps.length - 1 && (
                            <Button
                                type="primary"
                                size="large"
                                loading={createIsLoading}
                                onClick={handleConfirmSchedule}
                                style={{
                                    background: '#198754',
                                    borderColor: '#198754',
                                    minWidth: 200,
                                    fontWeight: 600,
                                    fontSize: 16
                                }}
                            >
                                {selectValue.paymentType === 'cash' ? 'Confirm Appointment (Pay at Clinic)' : 'Confirm & Proceed to Payment'}
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Razorpay Online Payment Modal */}
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
                        Doctor: <strong>Dr. {doctorData?.firstName} {doctorData?.lastName}</strong> ({selectedDate} at {selectTime})
                    </p>
                    <Divider style={{ margin: '12px 0' }} />
                    {createdAppointment?.id && (
                        <RazorpayCheckout
                            appointmentId={createdAppointment.id}
                            appointmentData={{
                                patientName: `${selectValue.firstName} ${selectValue.lastName}`,
                                email: selectValue.email,
                                phone: selectValue.phone,
                                doctorName: `${doctorData?.firstName || ''} ${doctorData?.lastName || ''}`,
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

export default DoctorBooking;
