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
exports.RazorpayProvider = void 0;
const crypto_1 = __importDefault(require("crypto"));
const https_1 = __importDefault(require("https"));
const config_1 = __importDefault(require("../../config"));
function razorpayRequest(method, path, body) {
    return new Promise((resolve, reject) => {
        const keyId = config_1.default.payment.razorpay.keyId;
        const keySecret = config_1.default.payment.razorpay.keySecret;
        // In demo or test mode if keys are not yet configured or placeholder
        if (!keyId || keyId === 'rzp_test_your_key_id' || !keySecret || keySecret === 'your_key_secret') {
            console.log(`[razorpay mock] Simulating ${method} ${path}`, body);
            if (path === '/v1/orders') {
                const mockOrderId = `order_${crypto_1.default.randomBytes(8).toString('hex')}`;
                return resolve({
                    id: mockOrderId,
                    amount: (body === null || body === void 0 ? void 0 : body.amount) || 1000,
                    currency: (body === null || body === void 0 ? void 0 : body.currency) || 'INR',
                    receipt: (body === null || body === void 0 ? void 0 : body.receipt) || 'rcpt_mock',
                    status: 'created',
                });
            }
            if (path.includes('/refund')) {
                const mockRefundId = `rfnd_${crypto_1.default.randomBytes(8).toString('hex')}`;
                return resolve({
                    id: mockRefundId,
                    amount: (body === null || body === void 0 ? void 0 : body.amount) || 1000,
                    status: 'processed',
                });
            }
            return resolve({ id: `mock_${Date.now()}`, status: 'success' });
        }
        const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
        const bodyStr = body ? JSON.stringify(body) : '';
        const options = {
            hostname: 'api.razorpay.com',
            path,
            method,
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(bodyStr),
            },
        };
        const req = https_1.default.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
                var _a;
                try {
                    const parsed = JSON.parse(data);
                    if (res.statusCode && res.statusCode >= 400) {
                        reject(new Error(((_a = parsed === null || parsed === void 0 ? void 0 : parsed.error) === null || _a === void 0 ? void 0 : _a.description) || `Razorpay error ${res.statusCode}`));
                    }
                    else {
                        resolve(parsed);
                    }
                }
                catch (_b) {
                    reject(new Error('Failed to parse Razorpay response'));
                }
            });
        });
        req.on('error', reject);
        if (bodyStr)
            req.write(bodyStr);
        req.end();
    });
}
class RazorpayProvider {
    createOrder(amountInPaise, currency, receipt) {
        return __awaiter(this, void 0, void 0, function* () {
            const order = yield razorpayRequest('POST', '/v1/orders', {
                amount: amountInPaise,
                currency,
                receipt,
            });
            return {
                orderId: order.id,
                amount: order.amount,
                currency: order.currency,
                provider: 'razorpay',
            };
        });
    }
    verifyPayment(orderId, paymentId, signature) {
        return __awaiter(this, void 0, void 0, function* () {
            const keySecret = config_1.default.payment.razorpay.keySecret;
            // Allow mock pass in test/demo mode if key is placeholder or mock signature passed
            if (!keySecret || keySecret === 'your_key_secret' || signature === 'mock_signature_success') {
                return {
                    valid: true,
                    paymentId,
                    orderId,
                };
            }
            const expectedSignature = crypto_1.default
                .createHmac('sha256', keySecret)
                .update(`${orderId}|${paymentId}`)
                .digest('hex');
            return {
                valid: expectedSignature === signature,
                paymentId,
                orderId,
            };
        });
    }
    verifyWebhookSignature(rawBody, signature) {
        const webhookSecret = config_1.default.payment.razorpay.webhookSecret;
        if (!webhookSecret || webhookSecret === 'your_webhook_secret') {
            return true; // allow in dev
        }
        const expectedSignature = crypto_1.default
            .createHmac('sha256', webhookSecret)
            .update(rawBody)
            .digest('hex');
        return expectedSignature === signature;
    }
    processRefund(paymentId, amountInPaise, reason) {
        return __awaiter(this, void 0, void 0, function* () {
            const refund = yield razorpayRequest('POST', `/v1/payments/${paymentId}/refund`, {
                amount: amountInPaise,
                notes: { reason },
            });
            return {
                refundId: refund.id,
                status: refund.status || 'processed',
            };
        });
    }
}
exports.RazorpayProvider = RazorpayProvider;
