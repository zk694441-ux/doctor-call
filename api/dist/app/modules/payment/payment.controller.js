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
exports.PaymentController = void 0;
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const http_status_1 = __importDefault(require("http-status"));
const payment_service_1 = require("./payment.service");
const createOrder = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield payment_service_1.PaymentService.createOrder(req.body, user);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Payment order created successfully',
        data: result,
    });
}));
const verifyPayment = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield payment_service_1.PaymentService.verifyPayment(req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Payment verified and appointment confirmed',
        data: result,
    });
}));
const handleWebhook = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const signature = (req.headers['x-razorpay-signature'] || '');
        const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
        yield payment_service_1.PaymentService.handleWebhook(rawBody, signature);
        res.status(http_status_1.default.OK).json({ received: true });
    }
    catch (err) {
        next(err);
    }
});
const requestRefund = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield payment_service_1.PaymentService.requestRefund(req.body, user);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Refund request initiated successfully',
        data: result,
    });
}));
const getPaymentHistory = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const result = yield payment_service_1.PaymentService.getPaymentHistory(user);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Payment history fetched successfully',
        data: result,
    });
}));
const getRefundStatus = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { refundId } = req.params;
    const result = yield payment_service_1.PaymentService.getRefundStatus(refundId, user);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Refund status fetched successfully',
        data: result,
    });
}));
const triggerCronJobs = (0, catchAsync_1.default)((_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const expiredCount = yield payment_service_1.PaymentService.expireAbandonedBookings();
    const remindersSent = yield payment_service_1.PaymentService.sendReminders();
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Cron maintenance tasks executed successfully',
        data: { expiredCount, remindersSent },
    });
}));
exports.PaymentController = {
    createOrder,
    verifyPayment,
    handleWebhook,
    requestRefund,
    getPaymentHistory,
    getRefundStatus,
    triggerCronJobs,
};
