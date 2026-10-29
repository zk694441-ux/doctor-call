"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentRouter = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = require("../../middlewares/auth");
const enums_1 = require("../../../enums");
const payment_controller_1 = require("./payment.controller");
const router = express_1.default.Router();
// Webhook endpoint (signature verified internally)
router.post('/webhook', payment_controller_1.PaymentController.handleWebhook);
// Payment order creation & verification
router.post('/create-order', payment_controller_1.PaymentController.createOrder);
router.post('/verify', payment_controller_1.PaymentController.verifyPayment);
// Refund management
router.post('/refund', (0, auth_1.auth)(enums_1.AuthUser.PATIENT, enums_1.AuthUser.ADMIN), payment_controller_1.PaymentController.requestRefund);
router.get('/refund/:refundId', (0, auth_1.auth)(enums_1.AuthUser.PATIENT, enums_1.AuthUser.ADMIN), payment_controller_1.PaymentController.getRefundStatus);
// Payment history & receipts
router.get('/history', (0, auth_1.auth)(enums_1.AuthUser.PATIENT, enums_1.AuthUser.ADMIN), payment_controller_1.PaymentController.getPaymentHistory);
// Vercel / serverless maintenance & cron tasks trigger
router.all('/cron-jobs', payment_controller_1.PaymentController.triggerCronJobs);
exports.PaymentRouter = router;
