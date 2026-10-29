"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentService = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = __importDefault(require("../../../shared/prisma"));
const apiError_1 = __importDefault(require("../../../errors/apiError"));
const http_status_1 = __importDefault(require("http-status"));
const moment_1 = __importDefault(require("moment"));
const config_1 = __importDefault(require("../../../config"));
const paymentProviders_1 = require("../../../helpers/paymentProviders");
const notificationEngine_1 = require("../../../helpers/notificationEngine");
/**
 * Creates a payment order (Razorpay / Stripe) using consultation fee from DB
 */
const createOrder = (payload, user) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const { appointmentId } = payload;
    const appointment = yield prisma_1.default.appointments.findUnique({
        where: { id: appointmentId },
        include: { doctor: true, patient: true },
    });
    if (!appointment) {
        throw new apiError_1.default(http_status_1.default.NOT_FOUND, 'Appointment not found');
    }
    // Prevent duplicate payment if already paid
    const existingPaid = yield prisma_1.default.payment.findFirst({
        where: { appointmentId, status: 'paid' },
    });
    if (existingPaid || appointment.paymentStatus === client_1.paymentStatus.paid) {
        throw new apiError_1.default(http_status_1.default.CONFLICT, 'This appointment has already been paid for');
    }
    // Calculate fees from Doctor profile stored in database
    const docFee = Number(((_a = appointment.doctor) === null || _a === void 0 ? void 0 : _a.price) || 60);
    const bookingFee = 10;
    const vat = (15 / 100) * (docFee + bookingFee);
    const totalAmountNum = docFee + bookingFee + vat;
    const amountInMinorUnit = Math.round(totalAmountNum * 100); // In paise / cents
    const receipt = `appt_${appointmentId.replace(/-/g, '').slice(0, 14)}`;
    const provider = (0, paymentProviders_1.getPaymentProvider)();
    let order;
    try {
        order = yield provider.createOrder(amountInMinorUnit, 'INR', receipt);
    }
    catch (err) {
        throw new apiError_1.default(http_status_1.default.SERVICE_UNAVAILABLE, `Payment gateway order creation failed: ${err.message}`);
    }
    // Idempotently create or update pending payment record
    let payment = yield prisma_1.default.payment.findFirst({ where: { appointmentId } });
    if (!payment) {
        payment = yield prisma_1.default.payment.create({
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
    }
    else {
        payment = yield prisma_1.default.payment.update({
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
    yield prisma_1.default.appointments.update({
        where: { id: appointmentId },
        data: {
            paymentPendingUntil: (0, moment_1.default)().add(15, 'minutes').toDate(),
        },
    });
    return {
        orderId: order.orderId,
        amount: order.amount,
        currency: order.currency,
        paymentRecordId: payment.id,
        keyId: ((_c = (_b = config_1.default.payment) === null || _b === void 0 ? void 0 : _b.razorpay) === null || _c === void 0 ? void 0 : _c.keyId) || '',
    };
});
/**
 * Verifies payment signature server-side and updates appointment/payment status consistently
 */
const verifyPayment = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    const { orderId, paymentId, signature } = payload;
    const payment = yield prisma_1.default.payment.findFirst({ where: { orderId } });
    if (!payment) {
        throw new apiError_1.default(http_status_1.default.NOT_FOUND, 'Payment record not found for this order');
    }
    // Idempotency: already verified
    if (payment.status === 'paid' && payment.paymentId) {
        return payment;
    }
    const provider = (0, paymentProviders_1.getPaymentProvider)();
    const verifyResult = yield provider.verifyPayment(orderId, paymentId, signature);
    if (!verifyResult.valid) {
        yield prisma_1.default.payment.update({
            where: { id: payment.id },
            data: { status: 'failed' },
        });
        throw new apiError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid payment signature. Verification failed.');
    }
    // Consistent transaction: update payment and appointment simultaneously
    const [updatedPayment, updatedAppointment] = yield prisma_1.default.$transaction([
        prisma_1.default.payment.update({
            where: { id: payment.id },
            data: {
                paymentId,
                status: 'paid',
            },
        }),
        prisma_1.default.appointments.update({
            where: { id: payment.appointmentId },
            data: {
                paymentStatus: client_1.paymentStatus.paid,
                paymentPendingUntil: null,
            },
            include: {
                doctor: true,
                patient: true,
            },
        }),
    ]);
    // Dispatch payment success notification (email / SMS / WhatsApp extensible)
    const patientEmail = updatedAppointment.email || ((_a = updatedAppointment.patient) === null || _a === void 0 ? void 0 : _a.email);
    if (patientEmail) {
        (0, notificationEngine_1.sendNotification)({
            type: 'payment-success',
            to: patientEmail,
            phone: updatedAppointment.phone || ((_b = updatedAppointment.patient) === null || _b === void 0 ? void 0 : _b.mobile) || undefined,
            data: {
                patientName: `${updatedAppointment.firstName || ((_c = updatedAppointment.patient) === null || _c === void 0 ? void 0 : _c.firstName) || ''} ${updatedAppointment.lastName || ((_d = updatedAppointment.patient) === null || _d === void 0 ? void 0 : _d.lastName) || ''}`.trim(),
                doctorName: `${((_e = updatedAppointment.doctor) === null || _e === void 0 ? void 0 : _e.firstName) || ''} ${((_f = updatedAppointment.doctor) === null || _f === void 0 ? void 0 : _f.lastName) || ''}`.trim(),
                scheduleDate: updatedAppointment.scheduleDate || '',
                scheduleTime: updatedAppointment.scheduleTime || '',
                trackingId: updatedAppointment.trackingId || '',
                paymentId,
                amount: updatedPayment.totalAmount.toFixed(2),
            },
        }).catch(() => { });
    }
    return updatedPayment;
});
/**
 * Secure webhook verification with idempotent event ledger
 */
const handleWebhook = (rawBody, signature) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    const provider = (0, paymentProviders_1.getPaymentProvider)();
    if (!provider.verifyWebhookSignature(rawBody, signature)) {
        throw new apiError_1.default(http_status_1.default.UNAUTHORIZED, 'Invalid webhook signature');
    }
    let event;
    try {
        event = JSON.parse(rawBody.toString('utf-8'));
    }
    catch (_g) {
        throw new apiError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid webhook JSON payload');
    }
    const eventId = event.id || `${event.event}_${Date.now()}`;
    // Idempotency check: process each event exactly once
    const existingEvent = yield prisma_1.default.paymentEvent.findUnique({
        where: { eventId },
    });
    if (existingEvent) {
        console.log(`[webhook] Event ${eventId} already processed, skipping.`);
        return;
    }
    // Record event in ledger
    yield prisma_1.default.paymentEvent.create({
        data: {
            eventId,
            provider: 'razorpay',
            eventType: event.event || 'unknown',
            payload: rawBody.toString('utf-8'),
        },
    });
    const eventType = event.event;
    if (eventType === 'payment.captured') {
        const paymentEntity = (_b = (_a = event.payload) === null || _a === void 0 ? void 0 : _a.payment) === null || _b === void 0 ? void 0 : _b.entity;
        const orderId = paymentEntity === null || paymentEntity === void 0 ? void 0 : paymentEntity.order_id;
        if (orderId) {
            const payment = yield prisma_1.default.payment.findFirst({ where: { orderId } });
            if (payment && payment.status !== 'paid') {
                yield prisma_1.default.$transaction([
                    prisma_1.default.payment.update({
                        where: { id: payment.id },
                        data: { paymentId: paymentEntity.id, status: 'paid' },
                    }),
                    prisma_1.default.appointments.update({
                        where: { id: payment.appointmentId },
                        data: { paymentStatus: client_1.paymentStatus.paid, paymentPendingUntil: null },
                    }),
                ]);
            }
        }
    }
    else if (eventType === 'payment.failed') {
        const paymentEntity = (_d = (_c = event.payload) === null || _c === void 0 ? void 0 : _c.payment) === null || _d === void 0 ? void 0 : _d.entity;
        const orderId = paymentEntity === null || paymentEntity === void 0 ? void 0 : paymentEntity.order_id;
        if (orderId) {
            const payment = yield prisma_1.default.payment.findFirst({ where: { orderId } });
            if (payment && payment.status === 'pending') {
                yield prisma_1.default.payment.update({
                    where: { id: payment.id },
                    data: { status: 'failed' },
                });
            }
        }
    }
    else if (eventType === 'refund.processed') {
        const refundEntity = (_f = (_e = event.payload) === null || _e === void 0 ? void 0 : _e.refund) === null || _f === void 0 ? void 0 : _f.entity;
        const gatewayRefundId = refundEntity === null || refundEntity === void 0 ? void 0 : refundEntity.id;
        if (gatewayRefundId) {
            yield prisma_1.default.refund.updateMany({
                where: { gatewayRefundId },
                data: {
                    status: 'completed',
                    processedAt: new Date(),
                },
            });
        }
    }
});
/**
 * Refund Management:
 * Cancellation does NOT imply refund is immediately completed.
 * Full and partial refunds are tracked with amount, status, reason, gateway ref.
 */
const requestRefund = (payload, user) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
    const { appointmentId, reason } = payload;
    const appointment = yield prisma_1.default.appointments.findUnique({
        where: { id: appointmentId },
        include: { doctor: true, patient: true },
    });
    if (!appointment) {
        throw new apiError_1.default(http_status_1.default.NOT_FOUND, 'Appointment not found');
    }
    // Patient authorization check
    if ((user === null || user === void 0 ? void 0 : user.role) === 'patient') {
        const isOwner = (appointment.patientId && appointment.patientId === user.userId) ||
            (appointment.email && appointment.email.toLowerCase() === (user.email || '').toLowerCase());
        if (!isOwner) {
            throw new apiError_1.default(http_status_1.default.FORBIDDEN, 'You are not authorized to cancel this appointment');
        }
    }
    // Locate paid payment
    const payment = yield prisma_1.default.payment.findFirst({
        where: { appointmentId, status: 'paid' },
        include: { refunds: true },
    });
    if (!payment) {
        throw new apiError_1.default(http_status_1.default.NOT_FOUND, 'No paid transaction found for this appointment');
    }
    // Check for duplicate refund requests
    const activeRefund = payment.refunds.find((r) => r.status === 'pending' || r.status === 'completed' || r.status === 'manual_pending');
    if (activeRefund) {
        throw new apiError_1.default(http_status_1.default.CONFLICT, `A refund request is already ${activeRefund.status}`);
    }
    // Calculate refund according to cancellation policy
    const appointmentMoment = (0, moment_1.default)(`${appointment.scheduleDate} ${appointment.scheduleTime}`, ['YYYY-MM-DD HH:mm', 'YYYY-MM-DD hh:mm A', 'LL hh:mm A', 'YYYY-MM-DD'], true);
    let hoursUntil = 48; // default safe fallback if date parsing is ambiguous
    if (appointmentMoment.isValid()) {
        hoursUntil = appointmentMoment.diff((0, moment_1.default)(), 'hours', true);
    }
    const fullHours = (_c = (_b = (_a = config_1.default.payment) === null || _a === void 0 ? void 0 : _a.refund) === null || _b === void 0 ? void 0 : _b.fullRefundHours) !== null && _c !== void 0 ? _c : 24;
    const partialHours = (_f = (_e = (_d = config_1.default.payment) === null || _d === void 0 ? void 0 : _d.refund) === null || _e === void 0 ? void 0 : _e.partialRefundHours) !== null && _f !== void 0 ? _f : 4;
    const partialPercent = (_j = (_h = (_g = config_1.default.payment) === null || _g === void 0 ? void 0 : _g.refund) === null || _h === void 0 ? void 0 : _h.partialRefundPercent) !== null && _j !== void 0 ? _j : 70;
    let refundPercent = 0;
    if (hoursUntil >= fullHours) {
        refundPercent = 100;
    }
    else if (hoursUntil >= partialHours) {
        refundPercent = partialPercent;
    }
    else {
        refundPercent = 0;
    }
    const calculatedRefundAmount = (payment.totalAmount * refundPercent) / 100;
    if (calculatedRefundAmount <= 0) {
        throw new apiError_1.default(http_status_1.default.BAD_REQUEST, `Cancellation is within ${partialHours} hours of appointment time. Per policy, no refund is eligible.`);
    }
    // Process gateway refund if paymentId exists
    let gatewayRefundId;
    let initialRefundStatus = 'pending';
    if (payment.paymentId) {
        try {
            const provider = (0, paymentProviders_1.getPaymentProvider)();
            const refundResult = yield provider.processRefund(payment.paymentId, Math.round(calculatedRefundAmount * 100), reason || 'Appointment cancelled by patient');
            gatewayRefundId = refundResult.refundId;
            if (refundResult.status === 'processed' || refundResult.status === 'succeeded') {
                initialRefundStatus = 'completed';
            }
        }
        catch (err) {
            console.warn('[refund] Gateway refund initiation note:', (err === null || err === void 0 ? void 0 : err.message) || err);
            // Mark as manual_pending so staff can review
            initialRefundStatus = 'manual_pending';
        }
    }
    else {
        initialRefundStatus = 'manual_pending';
    }
    // Create refund record
    const refund = yield prisma_1.default.refund.create({
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
    yield prisma_1.default.appointments.update({
        where: { id: appointmentId },
        data: {
            status: 'cancelled',
        },
    });
    // Send notifications: cancellation + refund initiated
    const patientEmail = appointment.email || ((_k = appointment.patient) === null || _k === void 0 ? void 0 : _k.email);
    if (patientEmail) {
        (0, notificationEngine_1.sendNotification)({
            type: 'refund-initiated',
            to: patientEmail,
            phone: appointment.phone || ((_l = appointment.patient) === null || _l === void 0 ? void 0 : _l.mobile) || undefined,
            data: {
                patientName: `${appointment.firstName || ((_m = appointment.patient) === null || _m === void 0 ? void 0 : _m.firstName) || ''} ${appointment.lastName || ((_o = appointment.patient) === null || _o === void 0 ? void 0 : _o.lastName) || ''}`.trim(),
                doctorName: `${((_p = appointment.doctor) === null || _p === void 0 ? void 0 : _p.firstName) || ''} ${((_q = appointment.doctor) === null || _q === void 0 ? void 0 : _q.lastName) || ''}`.trim(),
                trackingId: appointment.trackingId || '',
                refundAmount: calculatedRefundAmount.toFixed(2),
                reason: reason || 'Cancellation request',
            },
        }).catch(() => { });
    }
    return refund;
});
/**
 * Patient payment history & receipts
 */
const getPaymentHistory = (user) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId, email } = user || {};
    let patient = null;
    if (userId) {
        patient = yield prisma_1.default.patient.findUnique({ where: { id: userId } });
    }
    if (!patient && email) {
        patient = yield prisma_1.default.patient.findUnique({ where: { email } });
    }
    const patientId = (patient === null || patient === void 0 ? void 0 : patient.id) || userId;
    const patientEmail = (patient === null || patient === void 0 ? void 0 : patient.email) || email;
    const orConditions = [];
    if (patientId) {
        orConditions.push({ appointment: { patientId } });
    }
    if (patientEmail) {
        orConditions.push({ appointment: { email: { equals: patientEmail, mode: 'insensitive' } } });
    }
    return prisma_1.default.payment.findMany({
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
});
/**
 * Track refund status
 */
const getRefundStatus = (refundId, user) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const refund = yield prisma_1.default.refund.findUnique({
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
        throw new apiError_1.default(http_status_1.default.NOT_FOUND, 'Refund record not found');
    }
    if ((user === null || user === void 0 ? void 0 : user.role) === 'patient') {
        const isOwner = refund.payment.appointment.patientId === user.userId ||
            ((_a = refund.payment.appointment.email) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === (user.email || '').toLowerCase();
        if (!isOwner) {
            throw new apiError_1.default(http_status_1.default.FORBIDDEN, 'Not authorised to view this refund');
        }
    }
    return refund;
});
/**
 * Handle expired pending bookings and release slots
 */
const expireAbandonedBookings = () => __awaiter(void 0, void 0, void 0, function* () {
    const now = new Date();
    const expiredAppointments = yield prisma_1.default.appointments.findMany({
        where: {
            paymentPendingUntil: { lt: now },
            paymentStatus: client_1.paymentStatus.unpaid,
            status: 'pending',
        },
        include: {
            payment: { where: { status: 'pending' } },
        },
    });
    for (const appt of expiredAppointments) {
        for (const p of appt.payment) {
            yield prisma_1.default.payment.update({
                where: { id: p.id },
                data: { status: 'expired' },
            });
        }
        yield prisma_1.default.appointments.update({
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
});
/**
 * Configurable automated appointment reminders (24h and 1h ahead)
 * Ensures cancelled or completed appointments DO NOT receive reminders
 */
const sendReminders = () => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    // Find active, paid appointments
    const upcomingAppointments = yield prisma_1.default.appointments.findMany({
        where: {
            paymentStatus: client_1.paymentStatus.paid,
            status: { notIn: ['cancelled', 'completed', 'expired'] },
        },
        include: {
            doctor: true,
            patient: true,
        },
    });
    for (const appt of upcomingAppointments) {
        const apptMoment = (0, moment_1.default)(`${appt.scheduleDate} ${appt.scheduleTime}`, ['YYYY-MM-DD HH:mm', 'YYYY-MM-DD hh:mm A', 'LL hh:mm A', 'YYYY-MM-DD']);
        if (!apptMoment.isValid())
            continue;
        const diffHours = apptMoment.diff((0, moment_1.default)(), 'hours', true);
        // 24h window (between 23 and 25 hours ahead)
        if (diffHours >= 23 && diffHours <= 25) {
            const email = appt.email || ((_a = appt.patient) === null || _a === void 0 ? void 0 : _a.email);
            if (email) {
                (0, notificationEngine_1.sendNotification)({
                    type: 'appointment-reminder',
                    to: email,
                    phone: appt.phone || ((_b = appt.patient) === null || _b === void 0 ? void 0 : _b.mobile) || undefined,
                    data: {
                        patientName: `${appt.firstName || ((_c = appt.patient) === null || _c === void 0 ? void 0 : _c.firstName) || ''} ${appt.lastName || ((_d = appt.patient) === null || _d === void 0 ? void 0 : _d.lastName) || ''}`.trim(),
                        doctorName: `${((_e = appt.doctor) === null || _e === void 0 ? void 0 : _e.firstName) || ''} ${((_f = appt.doctor) === null || _f === void 0 ? void 0 : _f.lastName) || ''}`.trim(),
                        scheduleDate: appt.scheduleDate || '',
                        scheduleTime: appt.scheduleTime || '',
                        trackingId: appt.trackingId || '',
                        timeUntil: 'tomorrow (in 24 hours)',
                    },
                }).catch(() => { });
            }
        }
        // 1h window (between 0.75 and 1.25 hours ahead)
        if (diffHours >= 0.75 && diffHours <= 1.25) {
            const email = appt.email || ((_g = appt.patient) === null || _g === void 0 ? void 0 : _g.email);
            if (email) {
                (0, notificationEngine_1.sendNotification)({
                    type: 'appointment-reminder',
                    to: email,
                    phone: appt.phone || ((_h = appt.patient) === null || _h === void 0 ? void 0 : _h.mobile) || undefined,
                    data: {
                        patientName: `${appt.firstName || ((_j = appt.patient) === null || _j === void 0 ? void 0 : _j.firstName) || ''} ${appt.lastName || ((_k = appt.patient) === null || _k === void 0 ? void 0 : _k.lastName) || ''}`.trim(),
                        doctorName: `${((_l = appt.doctor) === null || _l === void 0 ? void 0 : _l.firstName) || ''} ${((_m = appt.doctor) === null || _m === void 0 ? void 0 : _m.lastName) || ''}`.trim(),
                        scheduleDate: appt.scheduleDate || '',
                        scheduleTime: appt.scheduleTime || '',
                        trackingId: appt.trackingId || '',
                        timeUntil: 'in 1 hour',
                    },
                }).catch(() => { });
            }
        }
    }
});
exports.PaymentService = {
    createOrder,
    verifyPayment,
    handleWebhook,
    requestRefund,
    getPaymentHistory,
    getRefundStatus,
    expireAbandonedBookings,
    sendReminders,
};
