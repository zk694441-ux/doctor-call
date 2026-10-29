import React, { useState } from 'react';
import { Button, message, Space } from 'antd';
import { useCreatePaymentOrderMutation, useVerifyPaymentMutation } from '../../redux/api/paymentApi';

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const RazorpayCheckout = ({ appointmentId, appointmentData, onSuccess, onFailure, disabled }) => {
  const [createOrder, { isLoading: isCreatingOrder }] = useCreatePaymentOrderMutation();
  const [verifyPayment, { isLoading: isVerifying }] = useVerifyPaymentMutation();
  const [isSimulating, setIsSimulating] = useState(false);

  const handleOnlinePayment = async () => {
    try {
      const orderRes = await createOrder({ appointmentId }).unwrap();
      const orderData = orderRes?.data || orderRes;
      const { orderId, amount, currency, keyId } = orderData;

      const activeKey = keyId || process.env.REACT_APP_RAZORPAY_KEY_ID || 'rzp_test_your_key_id';

      // Check if real keys are configured
      const isPlaceholderKey = !activeKey || activeKey.includes('your_key_id');

      if (isPlaceholderKey) {
        // Direct simulation for seamless developer testing when test keys aren't added yet
        message.info('Using Test Mode: verifying mock payment...');
        await simulateTestPayment(orderId);
        return;
      }

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        message.error('Could not load Razorpay SDK. Please check your network connection.');
        return;
      }

      const options = {
        key: activeKey,
        amount: amount,
        currency: currency || 'INR',
        name: 'Doctor Appointment Consultation',
        description: `Consultation with Dr. ${appointmentData?.doctorName || 'Doctor'}`,
        order_id: orderId,
        handler: async (response) => {
          try {
            await verifyPayment({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            }).unwrap();
            message.success('Payment verified! Consultation confirmed.');
            if (onSuccess) onSuccess(response);
          } catch (err) {
            message.error(err?.data?.message || 'Payment signature verification failed.');
            if (onFailure) onFailure(err);
          }
        },
        prefill: {
          name: appointmentData?.patientName || '',
          email: appointmentData?.email || '',
          contact: appointmentData?.phone || '',
        },
        theme: {
          color: '#0d6efd',
        },
        modal: {
          ondismiss: () => {
            message.warning('Payment window closed. Slot is held for 15 minutes.');
          },
        },
      };

      const rzpInstance = new window.Razorpay(options);
      rzpInstance.on('payment.failed', (response) => {
        message.error(`Payment failed: ${response?.error?.description || 'Transaction error'}`);
        if (onFailure) onFailure(response?.error);
      });
      rzpInstance.open();
    } catch (err) {
      console.error('[Razorpay error]', err);
      message.error(err?.data?.message || 'Failed to create payment order. Please try again.');
      if (onFailure) onFailure(err);
    }
  };

  const simulateTestPayment = async (orderId) => {
    setIsSimulating(true);
    try {
      let resolvedOrderId = orderId;
      if (!resolvedOrderId) {
        const orderRes = await createOrder({ appointmentId }).unwrap();
        const orderData = orderRes?.data || orderRes;
        resolvedOrderId = orderData.orderId;
      }

      await verifyPayment({
        orderId: resolvedOrderId,
        paymentId: `pay_sim_${Date.now()}`,
        signature: 'mock_signature_success',
      }).unwrap();

      message.success('Payment verified successfully!');
      if (onSuccess) onSuccess({ simulated: true });
    } catch (err) {
      message.error(err?.data?.message || 'Verification failed');
      if (onFailure) onFailure(err);
    } finally {
      setIsSimulating(false);
    }
  };

  const loading = isCreatingOrder || isVerifying || isSimulating;

  return (
    <div style={{ width: '100%', marginTop: 16 }}>
      <Button
        type="primary"
        size="large"
        block
        loading={loading}
        disabled={disabled}
        onClick={handleOnlinePayment}
        style={{
          height: 48,
          fontSize: 16,
          fontWeight: 600,
          background: '#0d6efd',
          borderColor: '#0d6efd',
        }}
      >
        {loading ? 'Processing...' : 'Pay with Razorpay (Cards, UPI, Netbanking)'}
      </Button>

      <div style={{ marginTop: 12, textAlign: 'center' }}>
        <Space orientation="horizontal" size="small">
          <Button
            type="dashed"
            size="small"
            onClick={() => simulateTestPayment()}
            loading={isSimulating}
          >
            ⚡ One-Click Test Payment (Sandbox Simulation)
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default RazorpayCheckout;
