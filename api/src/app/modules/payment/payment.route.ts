import express from 'express';
import { auth } from '../../middlewares/auth';
import { AuthUser } from '../../../enums';
import { PaymentController } from './payment.controller';

const router = express.Router();

// Webhook endpoint (signature verified internally)
router.post('/webhook', PaymentController.handleWebhook);

// Payment order creation & verification
router.post('/create-order', PaymentController.createOrder);
router.post('/verify', PaymentController.verifyPayment);

// Refund management
router.post('/refund', auth(AuthUser.PATIENT, AuthUser.ADMIN), PaymentController.requestRefund);
router.get('/refund/:refundId', auth(AuthUser.PATIENT, AuthUser.ADMIN), PaymentController.getRefundStatus);

// Payment history & receipts
router.get('/history', auth(AuthUser.PATIENT, AuthUser.ADMIN), PaymentController.getPaymentHistory);

// Vercel / serverless maintenance & cron tasks trigger
router.all('/cron-jobs', PaymentController.triggerCronJobs);

export const PaymentRouter = router;
