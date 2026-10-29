import moment from 'moment';
import { Link } from 'react-router-dom';
import { Card, Checkbox } from 'antd';
import { FaUserMd, FaCreditCard, FaMoneyBillWave, FaShieldAlt } from 'react-icons/fa';
import img from '../../../images/avatar.jpg';
import './BookingCheckout.css';
import '../../Appointment/AppointmentFlow.css';

const CheckoutPage = ({ handleChange, selectValue, isCheck, setIsChecked, data, selectedDate, selectTime }) => {
  const { paymentType = 'online' } = selectValue;

  const handleCheck = () => setIsChecked(!isCheck);

  const price = data?.price ?? 60;
  const doctorImg = data?.img ?? img;
  const bookingFee = 10;
  const vat = (15 / 100) * (Number(price) + bookingFee);
  const total = Number(price) + bookingFee + vat;

  const fullName = data
    ? `Dr. ${(data.firstName || '')} ${(data.lastName || '')}`.trim()
    : 'Doctor';

  const isOnlineSelected = paymentType === 'online' || paymentType === 'creditCard';

  return (
    <div className="appointment-step appointment-step--payment">
      <p className="appointment-step__title">Payment Options</p>
      <p className="appointment-step__subtitle">Choose your preferred consultation payment method.</p>

      <div className="checkout-layout">
        <div>
          <Card className="checkout-form-card">
            <p className="checkout-form-card__title">Select Payment Method</p>
            <div className="payment-method-options" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div
                className={`payment-method-option ${isOnlineSelected ? 'payment-method-option--active' : ''}`}
                onClick={() => {
                  handleChange({ target: { name: 'paymentType', value: 'online' } });
                  handleChange({ target: { name: 'paymentMethod', value: 'razorpay' } });
                }}
                role="button"
                tabIndex={0}
                style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
              >
                <FaCreditCard style={{ fontSize: '1.25rem', color: isOnlineSelected ? '#0d6efd' : '#6c757d' }} />
                <div>
                  <div style={{ fontWeight: 600 }}>Pay Online</div>
                  <div style={{ fontSize: '12px', color: '#6c757d' }}>Razorpay / UPI / Cards</div>
                </div>
              </div>

              <div
                className={`payment-method-option ${paymentType === 'cash' ? 'payment-method-option--active' : ''}`}
                onClick={() => {
                  handleChange({ target: { name: 'paymentType', value: 'cash' } });
                  handleChange({ target: { name: 'paymentMethod', value: 'cash' } });
                }}
                role="button"
                tabIndex={0}
                style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
              >
                <FaMoneyBillWave style={{ fontSize: '1.25rem', color: paymentType === 'cash' ? '#0d6efd' : '#6c757d' }} />
                <div>
                  <div style={{ fontWeight: 600 }}>Pay at Clinic</div>
                  <div style={{ fontSize: '12px', color: '#6c757d' }}>Cash on arrival</div>
                </div>
              </div>
            </div>

            {isOnlineSelected ? (
              <div style={{ background: '#f0f7ff', border: '1px solid #cce5ff', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#004085', fontWeight: 600, marginBottom: '6px' }}>
                  <FaShieldAlt /> 100% Secure Online Payment
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: '#495057' }}>
                  Your appointment slot will be reserved for 15 minutes while payment is processed securely via Razorpay. Supports Credit/Debit Cards, UPI, Net Banking, and Wallets.
                </p>
              </div>
            ) : (
              <div style={{ background: '#e8f5e9', border: '1px solid #c8e6c9', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2e7d32', fontWeight: 600, marginBottom: '6px' }}>
                  <FaMoneyBillWave /> Pay at Clinic
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: '#495057' }}>
                  You can pay the consultation fee in cash directly at the doctor's reception desk before your appointment.
                </p>
              </div>
            )}

            <div className="terms-accept mt-4">
              <Checkbox id="terms_accept" checked={isCheck} onChange={handleCheck}>
                I have read and accept the{' '}
                <a className="text-primary" href="#terms" style={{ cursor: 'pointer', textDecoration: 'none' }}>
                  Cancellation &amp; Refund Policy
                </a>{' '}
                (Full refund up to 24h prior, 70% partial refund up to 4h prior).
              </Checkbox>
            </div>
          </Card>
        </div>

        <div>
          <Card className="order-summary-card">
            {data && (
              <div className="text-center mb-3">
                <Link to={`/doctors/profile/${data?.id}`} className="booking-doc-img d-block mb-2">
                  {doctorImg ? (
                    <img src={doctorImg} alt={fullName} style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div className="select-doctor-card__placeholder" style={{ width: 80, height: 80, borderRadius: '50%', margin: '0 auto' }}>
                      <FaUserMd style={{ fontSize: '2rem' }} />
                    </div>
                  )}
                </Link>
                <h5 className="mb-0" style={{ fontSize: '1rem', fontWeight: 600 }}>{fullName}</h5>
                <p className="form-text mb-0 small">{data?.designation}</p>
              </div>
            )}
            <div className="summary-row">
              <span>Date</span>
              <span>{selectedDate ? moment(selectedDate).format('LL') : '—'}</span>
            </div>
            <div className="summary-row">
              <span>Time</span>
              <span>{selectTime || '—'}</span>
            </div>
            <div className="summary-row">
              <span>Consultation fee</span>
              <span>${price}</span>
            </div>
            <div className="summary-row">
              <span>Booking fee</span>
              <span>${bookingFee}</span>
            </div>
            <div className="summary-row">
              <span>VAT (15%)</span>
              <span>${vat.toFixed(2)}</span>
            </div>
            <div className="summary-row summary-total">
              <span>Total Payable</span>
              <span className="amount">${total.toFixed(2)}</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
