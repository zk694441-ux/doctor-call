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
exports.sendNotification = sendNotification;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const handlebars_1 = __importDefault(require("handlebars"));
const Transporter_1 = require("./Transporter");
const config_1 = __importDefault(require("../config"));
const templateMap = {
    'appointment-confirmed': 'appointment.html',
    'payment-success': 'payment-success.html',
    'payment-failed': 'payment-failed.html',
    'refund-initiated': 'refund-initiated.html',
    'refund-completed': 'refund-completed.html',
    'appointment-reminder': 'appointment-reminder.html',
    'appointment-cancelled': 'appointment-cancelled.html',
    'appointment-rescheduled': 'appointment.html',
};
const subjectMap = {
    'appointment-confirmed': 'Appointment Confirmed - Doctor Appointment',
    'payment-success': 'Payment Successful - Consultation Confirmed',
    'payment-failed': 'Payment Failed - Please Retry',
    'refund-initiated': 'Refund Initiated for Your Appointment',
    'refund-completed': 'Refund Completed Successfully',
    'appointment-reminder': 'Appointment Reminder - Upcoming Consultation',
    'appointment-cancelled': 'Appointment Cancellation Notice',
    'appointment-rescheduled': 'Appointment Rescheduled Notice',
};
function readTemplate(templateFile) {
    return __awaiter(this, void 0, void 0, function* () {
        const possiblePaths = [
            path_1.default.join(__dirname, '../../../template', templateFile),
            path_1.default.join(__dirname, '../../template', templateFile),
            path_1.default.join(process.cwd(), 'template', templateFile),
            path_1.default.join(process.cwd(), 'dist', 'template', templateFile),
        ];
        for (const p of possiblePaths) {
            try {
                if (fs_1.default.existsSync(p)) {
                    return yield fs_1.default.promises.readFile(p, { encoding: 'utf-8' });
                }
            }
            catch (_a) {
                // try next
            }
        }
        return null;
    });
}
function sendNotification(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const { channel = 'email', type, to, phone, data } = options;
        // Extensible SMS and WhatsApp channels
        if (channel === 'sms') {
            console.log(`[Notification SMS] To: ${phone || to} | Type: ${type} | Data:`, data);
            return;
        }
        if (channel === 'whatsapp') {
            console.log(`[Notification WhatsApp] To: ${phone || to} | Type: ${type} | Data:`, data);
            return;
        }
        // Email channel
        const templateFile = templateMap[type];
        const subject = subjectMap[type] || 'Appointment Notification';
        if (!config_1.default.emailPass || config_1.default.emailPass === 'YOUR_EMAIL_APP_PASSWORD_WITH_NO_SPACE') {
            console.log(`[Notification Email] (Dev/Demo simulated) Subject: "${subject}" | To: ${to}`);
            return;
        }
        try {
            const rawHtml = yield readTemplate(templateFile);
            if (!rawHtml) {
                console.warn(`[Notification] Template file ${templateFile} not found`);
                return;
            }
            const compiled = handlebars_1.default.compile(rawHtml);
            const html = compiled(data);
            yield Transporter_1.Transporter.sendMail({
                from: `<${config_1.default.adminEmail || 'noreply@doctorappointment.com'}>`,
                to,
                subject,
                html,
            });
        }
        catch (err) {
            console.error(`[Notification] Email send failed for ${type} to ${to}:`, (err === null || err === void 0 ? void 0 : err.message) || err);
            // Never crash caller
        }
    });
}
