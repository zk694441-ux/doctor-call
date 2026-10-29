import crypto from 'crypto';
import { IPaymentProvider, CreateOrderResult, VerifyPaymentResult, RefundResult } from './IPaymentProvider';
import config from '../../config';

export class StripeProvider implements IPaymentProvider {
  async createOrder(amountInCents: number, currency: string, receipt: string): Promise<CreateOrderResult> {
    const mockSessionId = `cs_test_${crypto.randomBytes(12).toString('hex')}`;
    return {
      orderId: mockSessionId,
      amount: amountInCents,
      currency: currency || 'USD',
      provider: 'stripe',
    };
  }

  async verifyPayment(orderId: string, paymentId: string, signature: string): Promise<VerifyPaymentResult> {
    return {
      valid: true,
      paymentId: paymentId || `pi_${crypto.randomBytes(10).toString('hex')}`,
      orderId,
    };
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    return true;
  }

  async processRefund(paymentId: string, amountInCents: number, reason: string): Promise<RefundResult> {
    return {
      refundId: `re_${crypto.randomBytes(10).toString('hex')}`,
      status: 'succeeded',
    };
  }
}
