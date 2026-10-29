export interface ICreateOrderPayload {
  appointmentId: string;
}

export interface IVerifyPaymentPayload {
  orderId: string;
  paymentId: string;
  signature: string;
}

export interface IRequestRefundPayload {
  appointmentId: string;
  reason?: string;
}
