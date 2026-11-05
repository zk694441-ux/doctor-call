"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(process.cwd(), '.env') });
const clientUrl = process.env.NODE_ENV === "development" ? process.env.CLIENT__LOCAL_URL : process.env.CLIENT_URL;
const showErrorDetails = process.env.NODE_ENV !== 'production' ||
    process.env.SHOW_ERROR_DETAILS === 'true' ||
    process.env.VERCEL_ENV === 'preview';
exports.default = {
    env: process.env.NODE_ENV,
    showErrorDetails,
    port: process.env.PORT,
    default_doctor_pass: process.env.DOCTOR_PASS,
    clientUrl: clientUrl,
    jwt: {
        secret: process.env.JWT_SCRET || 'f9Hr6v38sK2nA5xGt4wDcR7uJ1mZlP0b',
        JWT_EXPIRES_IN: process.env.JWT_EXPIRED_IN || '30d',
        refresh_secret: (_b = (_a = process.env.JWT_REFRESH_SECRET) !== null && _a !== void 0 ? _a : process.env.JWT_REFRESH_SCRET) !== null && _b !== void 0 ? _b : 'f9Hr6v38sK2nA5xGt4wDcR7uJ1mZlP0b',
    },
    cloudinary: {
        name: process.env.CLOUND_NAME,
        key: process.env.API_KEY,
        secret: process.env.API_SECRET
    },
    emailPass: process.env.EMAIL_PASS || 'ocffuasrjncvrxrz',
    adminEmail: process.env.ADMIN_EMAIL || 'zk7362302@gmail.com',
    gmail_app_Email: process.env.GMAIL_APP_EMAIL || 'zk7362302@gmail.com',
    defaultAdminDoctor: process.env.DEFULT_ADMIN_DOCTOR,
    backendLiveUrl: process.env.BACKEND_LIVE_URL,
    backendLocalUrl: process.env.BACKEND_LOCAL_URL,
    payment: {
        provider: process.env.PAYMENT_PROVIDER || 'razorpay',
        razorpay: {
            keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_Ttk9UFN2tOC6Ve',
            keySecret: process.env.RAZORPAY_KEY_SECRET || 'Pn3RxCjN09Nb76s4X8cYgXn6',
            webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || 'razorpay_webhook_secret_doctor_app',
        },
        stripe: {
            secretKey: process.env.STRIPE_SECRET_KEY || '',
            webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
        },
        refund: {
            fullRefundHours: Number(process.env.REFUND_FULL_HOURS) || 24,
            partialRefundHours: Number(process.env.REFUND_PARTIAL_HOURS) || 4,
            partialRefundPercent: Number(process.env.REFUND_PARTIAL_PERCENT) || 70,
        },
    },
};
