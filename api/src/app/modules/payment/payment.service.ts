import { Payment, Refund, paymentStatus } from '@prisma/client';
import prisma from '../../../shared/prisma';
import ApiError from '../../../errors/apiError';
import httpStatus from 'http-status';
import moment from 'moment';
import config from '../../../config';
import { getPaymentProvider } from '../../../helpers/paymentProviders';
import { sendNotification } from '../../../helpers/notificationEngine';
import { ICreateOrderPayload, IVerifyPaymentPayload, IRequestRefundPayload } from './payment.interface';

/**
 * Creates a payment order (Razorpay / Stripe) using consultation fee from DB
 */
const createOrder = async (payload: ICreateOrderPayload, user: any): Promise<object> => {
  const { appointmentId } = payload;

  const appointment = await prisma.appointments.findUnique({
    where: { id: appointmentId },
    include: { doctor: true, patient: true },
  });

  if (!appointment) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Appointment not found');
  }

  // Prevent duplicate payment if already paid
  const existingPaid = await prisma.payment.findFirst({
    where: { appointmentId, status: 'paid' },
  });
  if (existingPaid || appointment.paymentStatus === paymentStatus.paid) {
    throw new ApiError(httpStatus.CONFLICT, 'This appointment has already been paid for');
  }

  // Calculate fees from Doctor profile stored in database
  const docFee = Number(appointment.doctor?.price || 60);
  const bookingFee = 10;
  const vat = (15 / 100) * (docFee + bookingFee);
  const totalAmountNum = docFee + bookingFee + vat;
  const amountInMinorUnit = Math.round(totalAmountNum * 100); // In paise / cents

  const receipt = `appt_${appointmentId.replace(/-/g, '').slice(0, 14)}`;
  const provider = getPaymentProvider();

  let order;
  try {
    order = await provider.createOrder(amountInMinorUnit, 'INR', receipt);
  } catch (err: any) {
    throw new ApiError(httpStatus.SERVICE_UNAVAILABLE, `Payment gateway order creation failed: ${err.message}`);
  }

  // Idempotently create or update pending payment record
  let payment = await prisma.payment.findFirst({ where: { appointmentId } });
  if (!payment) {
    payment = await prisma.payment.create({
      data: {
        appointmentId,
        paymentMethod: 'razorpay',
        paymentType: 'online',
        DoctorFee: docFee,
        bookingFee: bookingFee,
        vat,
        totalAmount: totalAmountNum,
        provider: 'razorpay',
        orderId: order.orderId,
        status: 'pending',
      },
    });
  } else {
    payment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        orderId: order.orderId,
        status: 'pending',
        provider: 'razorpay',
        DoctorFee: docFee,
        bookingFee,
        vat,
        totalAmount: totalAmountNum,
      },
    });
  }

  // Lock slot for 15 minutes to prevent overbooking
  await prisma.appointments.update({
    where: { id: appointmentId },
    data: {
      paymentPendingUntil: moment().add(15, 'minutes').toDate(),
    },
  });

  return {
    orderId: order.orderId,
    amount: order.amount,
    currency: order.currency,
    paymentRecordId: payment.id,
    keyId: config.payment?.razorpay?.keyId || '',
  };
};

/**
 * Verifies payment signature server-side and updates appointment/payment status consistently
 */
const verifyPayment = async (payload: IVerifyPaymentPayload): Promise<Payment> => {
  const { orderId, paymentId, signature } = payload;

  const payment = await prisma.payment.findFirst({ where: { orderId } });
  if (!payment) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Payment record not found for this order');
  }

  // Idempotency: already verified
  if (payment.status === 'paid' && payment.paymentId) {
    return payment;
  }

  const provider = getPaymentProvider();
  const verifyResult = await provider.verifyPayment(orderId, paymentId, signature);

  if (!verifyResult.valid) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'failed' },
    });
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid payment signature. Verification failed.');
  }

  // Consistent transaction: update payment and appointment simultaneously
  const [updatedPayment, updatedAppointment] = await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        paymentId,
        status: 'paid',
      },
    }),
    prisma.appointments.update({
      where: { id: payment.appointmentId },
      data: {
        paymentStatus: paymentStatus.paid,
        paymentPendingUntil: null,
      },
      include: {
        doctor: true,
        patient: true,
      },
    }),
  ]);

  // Dispatch payment success notification (email / SMS / WhatsApp extensible)
  const patientEmail = updatedAppointment.email || updatedAppointment.patient?.email;
  if (patientEmail) {
    sendNotification({
      type: 'payment-success',
      to: patientEmail,
      phone: updatedAppointment.phone || updatedAppointment.patient?.mobile || undefined,
      data: {
        patientName: `${updatedAppointment.firstName || updatedAppointment.patient?.firstName || ''} ${updatedAppointment.lastName || updatedAppointment.patient?.lastName || ''}`.trim(),
        doctorName: `${updatedAppointment.doctor?.firstName || ''} ${updatedAppointment.doctor?.lastName || ''}`.trim(),
        scheduleDate: updatedAppointment.scheduleDate || '',
        scheduleTime: updatedAppointment.scheduleTime || '',
        trackingId: updatedAppointment.trackingId || '',
        paymentId,
        amount: updatedPayment.totalAmount.toFixed(2),
      },
    }).catch(() => {});
  }

  return updatedPayment;
};

/**
 * Secure webhook verification with idempotent event ledger
 */
const handleWebhook = async (rawBody: Buffer, signature: string): Promise<void> => {
  const provider = getPaymentProvider();

  if (!provider.verifyWebhookSignature(rawBody, signature)) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid webhook signature');
  }

  let event: any;
  try {
    event = JSON.parse(rawBody.toString('utf-8'));
  } catch {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid webhook JSON payload');
  }

  const eventId = event.id || `${event.event}_${Date.now()}`;

  // Idempotency check: process each event exactly once
  const existingEvent = await prisma.paymentEvent.findUnique({
    where: { eventId },
  });
  if (existingEvent) {
    console.log(`[webhook] Event ${eventId} already processed, skipping.`);
    return;
  }

  // Record event in ledger
  await prisma.paymentEvent.create({
    data: {
      eventId,
      provider: 'razorpay',
      eventType: event.event || 'unknown',
      payload: rawBody.toString('utf-8'),
    },
  });

  const eventType = event.event;

  if (eventType === 'payment.captured') {
    const paymentEntity = event.payload?.payment?.entity;
    const orderId = paymentEntity?.order_id;
    if (orderId) {
      const payment = await prisma.payment.findFirst({ where: { orderId } });
      if (payment && payment.status !== 'paid') {
        await prisma.$transaction([
          prisma.payment.update({
            where: { id: payment.id },
            data: { paymentId: paymentEntity.id, status: 'paid' },
          }),
          prisma.appointments.update({
            where: { id: payment.appointmentId },
            data: { paymentStatus: paymentStatus.paid, paymentPendingUntil: null },
          }),
        ]);
      }
    }
  } else if (eventType === 'payment.failed') {
    const paymentEntity = event.payload?.payment?.entity;
    const orderId = paymentEntity?.order_id;
    if (orderId) {
      const payment = await prisma.payment.findFirst({ where: { orderId } });
      if (payment && payment.status === 'pending') {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'failed' },
        });
      }
    }
  } else if (eventType === 'refund.processed') {
    const refundEntity = event.payload?.refund?.entity;
    const gatewayRefundId = refundEntity?.id;
    if (gatewayRefundId) {
      await prisma.refund.updateMany({
        where: { gatewayRefundId },
        data: {
          status: 'completed',
          processedAt: new Date(),
        },
      });
    }
  }
};

/**
 * Refund Management:
 * Cancellation does NOT imply refund is immediately completed.
 * Full and partial refunds are tracked with amount, status, reason, gateway ref.
 */
const requestRefund = async (payload: IRequestRefundPayload, user: any): Promise<Refund> => {
  const { appointmentId, reason } = payload;

  const appointment = await prisma.appointments.findUnique({
    where: { id: appointmentId },
    include: { doctor: true, patient: true },
  });

  if (!appointment) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Appointment not found');
  }

  // Patient authorization check
  if (user?.role === 'patient') {
    const isOwner =
      (appointment.patientId && appointment.patientId === user.userId) ||
      (appointment.email && appointment.email.toLowerCase() === (user.email || '').toLowerCase());
    if (!isOwner) {
      throw new ApiError(httpStatus.FORBIDDEN, 'You are not authorized to cancel this appointment');
    }
  }

  // Locate paid payment
  const payment = await prisma.payment.findFirst({
    where: { appointmentId, status: 'paid' },
    include: { refunds: true },
  });

  if (!payment) {
    throw new ApiError(httpStatus.NOT_FOUND, 'No paid transaction found for this appointment');
  }

  // Check for duplicate refund requests
  const activeRefund = payment.refunds.find(
    (r) => r.status === 'pending' || r.status === 'completed' || r.status === 'manual_pending'
  );
  if (activeRefund) {
    throw new ApiError(httpStatus.CONFLICT, `A refund request is already ${activeRefund.status}`);
  }

  // Calculate refund according to cancellation policy
  const appointmentMoment = moment(
    `${appointment.scheduleDate} ${appointment.scheduleTime}`,
    ['YYYY-MM-DD HH:mm', 'YYYY-MM-DD hh:mm A', 'LL hh:mm A', 'YYYY-MM-DD'],
    true
  );

  let hoursUntil = 48; // default safe fallback if date parsing is ambiguous
  if (appointmentMoment.isValid()) {
    hoursUntil = appointmentMoment.diff(moment(), 'hours', true);
  }

  const fullHours = config.payment?.refund?.fullRefundHours ?? 24;
  const partialHours = config.payment?.refund?.partialRefundHours ?? 4;
  const partialPercent = config.payment?.refund?.partialRefundPercent ?? 70;

  let refundPercent = 0;
  if (hoursUntil >= fullHours) {
    refundPercent = 100;
  } else if (hoursUntil >= partialHours) {
    refundPercent = partialPercent;
  } else {
    refundPercent = 0;
  }

  const calculatedRefundAmount = (payment.totalAmount * refundPercent) / 100;

  if (calculatedRefundAmount <= 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Cancellation is within ${partialHours} hours of appointment time. Per policy, no refund is eligible.`
    );
  }

  // Process gateway refund if paymentId exists
  let gatewayRefundId: string | undefined;
  let initialRefundStatus = 'pending';

  if (payment.paymentId) {
    try {
      const provider = getPaymentProvider();
      const refundResult = await provider.processRefund(
        payment.paymentId,
        Math.round(calculatedRefundAmount * 100),
        reason || 'Appointment cancelled by patient'
      );
      gatewayRefundId = refundResult.refundId;
      if (refundResult.status === 'processed' || refundResult.status === 'succeeded') {
        initialRefundStatus = 'completed';
      }
    } catch (err: any) {
      console.warn('[refund] Gateway refund initiation note:', err?.message || err);
      // Mark as manual_pending so staff can review
      initialRefundStatus = 'manual_pending';
    }
  } else {
    initialRefundStatus = 'manual_pending';
  }

  // Create refund record
  const refund = await prisma.refund.create({
    data: {
      paymentId: payment.id,
      amount: calculatedRefundAmount,
      reason: reason || 'Patient cancelled consultation',
      status: initialRefundStatus,
      gatewayRefundId: gatewayRefundId || null,
      processedAt: initialRefundStatus === 'completed' ? new Date() : null,
    },
  });

  // Cancel appointment without marking refund as completed if still pending
  await prisma.appointments.update({
    where: { id: appointmentId },
    data: {
      status: 'cancelled',
    },
  });

  // Send notifications: cancellation + refund initiated
  const patientEmail = appointment.email || appointment.patient?.email;
  if (patientEmail) {
    sendNotification({
      type: 'refund-initiated',
      to: patientEmail,
      phone: appointment.phone || appointment.patient?.mobile || undefined,
      data: {
        patientName: `${appointment.firstName || appointment.patient?.firstName || ''} ${appointment.lastName || appointment.patient?.lastName || ''}`.trim(),
        doctorName: `${appointment.doctor?.firstName || ''} ${appointment.doctor?.lastName || ''}`.trim(),
        trackingId: appointment.trackingId || '',
        refundAmount: calculatedRefundAmount.toFixed(2),
        reason: reason || 'Cancellation request',
      },
    }).catch(() => {});
  }

  return refund;
};

/**
 * Patient payment history & receipts
 */
const getPaymentHistory = async (user: any): Promise<Payment[]> => {
  const { userId, email } = user || {};
  let patient = null;
  if (userId) {
    patient = await prisma.patient.findUnique({ where: { id: userId } });
  }
  if (!patient && email) {
    patient = await prisma.patient.findUnique({ where: { email } });
  }

  const patientId = patient?.id || userId;
  const patientEmail = patient?.email || email;

  const orConditions = [];
  if (patientId) {
    orConditions.push({ appointment: { patientId } });
  }
  if (patientEmail) {
    orConditions.push({ appointment: { email: { equals: patientEmail, mode: 'insensitive' as const } } });
  }

  return prisma.payment.findMany({
    where: orConditions.length > 0 ? { OR: orConditions } : {},
    include: {
      appointment: {
        include: {
          doctor: {
            select: { firstName: true, lastName: true, designation: true },
          },
        },
      },
      refunds: true,
    },
    orderBy: { createdAt: 'desc' },
  });
};

/**
 * Track refund status
 */
const getRefundStatus = async (refundId: string, user: any): Promise<Refund> => {
  const refund = await prisma.refund.findUnique({
    where: { id: refundId },
    include: {
      payment: {
        include: {
          appointment: true,
        },
      },
    },
  });

  if (!refund) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Refund record not found');
  }

  if (user?.role === 'patient') {
    const isOwner =
      refund.payment.appointment.patientId === user.userId ||
      refund.payment.appointment.email?.toLowerCase() === (user.email || '').toLowerCase();
    if (!isOwner) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Not authorised to view this refund');
    }
  }

  return refund;
};

/**
 * Handle expired pending bookings and release slots
 */
const expireAbandonedBookings = async (): Promise<void> => {
  const now = new Date();
  const expiredAppointments = await prisma.appointments.findMany({
    where: {
      paymentPendingUntil: { lt: now },
      paymentStatus: paymentStatus.unpaid,
      status: 'pending',
    },
    include: {
      payment: { where: { status: 'pending' } },
    },
  });

  for (const appt of expiredAppointments) {
    for (const p of appt.payment) {
      await prisma.payment.update({
        where: { id: p.id },
        data: { status: 'expired' },
      });
    }
    await prisma.appointments.update({
      where: { id: appt.id },
      data: {
        paymentPendingUntil: null,
        status: 'expired',
      },
    });
  }

  if (expiredAppointments.length > 0) {
    console.log(`[payment] Cleaned up ${expiredAppointments.length} expired pending bookings`);
  }
};

/**
 * Configurable automated appointment reminders (24h and 1h ahead)
 * Ensures cancelled or completed appointments DO NOT receive reminders
 */
const sendReminders = async (): Promise<void> => {
  // Find active, paid appointments
  const upcomingAppointments = await prisma.appointments.findMany({
    where: {
      paymentStatus: paymentStatus.paid,
      status: { notIn: ['cancelled', 'completed', 'expired'] },
    },
    include: {
      doctor: true,
      patient: true,
    },
  });

  for (const appt of upcomingAppointments) {
    const apptMoment = moment(
      `${appt.scheduleDate} ${appt.scheduleTime}`,
      ['YYYY-MM-DD HH:mm', 'YYYY-MM-DD hh:mm A', 'LL hh:mm A', 'YYYY-MM-DD']
    );

    if (!apptMoment.isValid()) continue;

    const diffHours = apptMoment.diff(moment(), 'hours', true);

    // 24h window (between 23 and 25 hours ahead)
    if (diffHours >= 23 && diffHours <= 25) {
      const email = appt.email || appt.patient?.email;
      if (email) {
        sendNotification({
          type: 'appointment-reminder',
          to: email,
          phone: appt.phone || appt.patient?.mobile || undefined,
          data: {
            patientName: `${appt.firstName || appt.patient?.firstName || ''} ${appt.lastName || appt.patient?.lastName || ''}`.trim(),
            doctorName: `${appt.doctor?.firstName || ''} ${appt.doctor?.lastName || ''}`.trim(),
            scheduleDate: appt.scheduleDate || '',
            scheduleTime: appt.scheduleTime || '',
            trackingId: appt.trackingId || '',
            timeUntil: 'tomorrow (in 24 hours)',
          },
        }).catch(() => {});
      }
    }

    // 1h window (between 0.75 and 1.25 hours ahead)
    if (diffHours >= 0.75 && diffHours <= 1.25) {
      const email = appt.email || appt.patient?.email;
      if (email) {
        sendNotification({
          type: 'appointment-reminder',
          to: email,
          phone: appt.phone || appt.patient?.mobile || undefined,
          data: {
            patientName: `${appt.firstName || appt.patient?.firstName || ''} ${appt.lastName || appt.patient?.lastName || ''}`.trim(),
            doctorName: `${appt.doctor?.firstName || ''} ${appt.doctor?.lastName || ''}`.trim(),
            scheduleDate: appt.scheduleDate || '',
            scheduleTime: appt.scheduleTime || '',
            trackingId: appt.trackingId || '',
            timeUntil: 'in 1 hour',
          },
        }).catch(() => {});
      }
    }
  }
};

export const PaymentService = {
  createOrder,
  verifyPayment,
  handleWebhook,
  requestRefund,
  getPaymentHistory,
  getRefundStatus,
  expireAbandonedBookings,
  sendReminders,
};
