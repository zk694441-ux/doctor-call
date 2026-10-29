export interface CreateOrderResult {
  orderId: string;
  amount: number;
  currency: string;
  provider: string;
}

export interface VerifyPaymentResult {
  valid: boolean;
  paymentId?: string;
  orderId?: string;
}

export interface RefundResult {
  refundId: string;
  status: string;
}

export interface IPaymentProvider {
  createOrder(amountInMinorUnit: number, currency: string, receipt: string): Promise<CreateOrderResult>;
  verifyPayment(orderId: string, paymentId: string, signature: string): Promise<VerifyPaymentResult>;
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean;
  processRefund(paymentId: string, amountInMinorUnit: number, reason: string): Promise<RefundResult>;
}
