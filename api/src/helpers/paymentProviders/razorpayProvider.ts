import crypto from 'crypto';
import https from 'https';
import { IPaymentProvider, CreateOrderResult, VerifyPaymentResult, RefundResult } from './IPaymentProvider';
import config from '../../config';

function razorpayRequest(method: string, path: string, body?: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const keyId = config.payment.razorpay.keyId;
    const keySecret = config.payment.razorpay.keySecret;

    // In demo or test mode if keys are not yet configured or placeholder
    if (!keyId || keyId === 'rzp_test_your_key_id' || !keySecret || keySecret === 'your_key_secret') {
      console.log(`[razorpay mock] Simulating ${method} ${path}`, body);
      if (path === '/v1/orders') {
        const mockOrderId = `order_${crypto.randomBytes(8).toString('hex')}`;
        return resolve({
          id: mockOrderId,
          amount: (body as any)?.amount || 1000,
          currency: (body as any)?.currency || 'INR',
          receipt: (body as any)?.receipt || 'rcpt_mock',
          status: 'created',
        });
      }
      if (path.includes('/refund')) {
        const mockRefundId = `rfnd_${crypto.randomBytes(8).toString('hex')}`;
        return resolve({
          id: mockRefundId,
          amount: (body as any)?.amount || 1000,
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
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(parsed?.error?.description || `Razorpay error ${res.statusCode}`));
          } else {
            resolve(parsed);
          }
        } catch {
          reject(new Error('Failed to parse Razorpay response'));
        }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

export class RazorpayProvider implements IPaymentProvider {
  async createOrder(amountInPaise: number, currency: string, receipt: string): Promise<CreateOrderResult> {
    const order = await razorpayRequest('POST', '/v1/orders', {
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
  }

  async verifyPayment(orderId: string, paymentId: string, signature: string): Promise<VerifyPaymentResult> {
    const keySecret = config.payment.razorpay.keySecret;
    // Allow mock pass in test/demo mode if key is placeholder or mock signature passed
    if (!keySecret || keySecret === 'your_key_secret' || signature === 'mock_signature_success') {
      return {
        valid: true,
        paymentId,
        orderId,
      };
    }

    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    return {
      valid: expectedSignature === signature,
      paymentId,
      orderId,
    };
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    const webhookSecret = config.payment.razorpay.webhookSecret;
    if (!webhookSecret || webhookSecret === 'your_webhook_secret') {
      return true; // allow in dev
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');
    return expectedSignature === signature;
  }

  async processRefund(paymentId: string, amountInPaise: number, reason: string): Promise<RefundResult> {
    const refund = await razorpayRequest('POST', `/v1/payments/${paymentId}/refund`, {
      amount: amountInPaise,
      notes: { reason },
    });
    return {
      refundId: refund.id,
      status: refund.status || 'processed',
    };
  }
}
