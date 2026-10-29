import { Request, Response, NextFunction } from 'express';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import httpStatus from 'http-status';
import { PaymentService } from './payment.service';

const createOrder = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const result = await PaymentService.createOrder(req.body, user);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payment order created successfully',
    data: result,
  });
});

const verifyPayment = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentService.verifyPayment(req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payment verified and appointment confirmed',
    data: result,
  });
});

const handleWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const signature = (req.headers['x-razorpay-signature'] || '') as string;
    const rawBody = (req as any).rawBody || Buffer.from(JSON.stringify(req.body));
    await PaymentService.handleWebhook(rawBody, signature);
    res.status(httpStatus.OK).json({ received: true });
  } catch (err) {
    next(err);
  }
};

const requestRefund = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const result = await PaymentService.requestRefund(req.body, user);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Refund request initiated successfully',
    data: result,
  });
});

const getPaymentHistory = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const result = await PaymentService.getPaymentHistory(user);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payment history fetched successfully',
    data: result,
  });
});

const getRefundStatus = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { refundId } = req.params;
  const result = await PaymentService.getRefundStatus(refundId, user);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Refund status fetched successfully',
    data: result,
  });
});

const triggerCronJobs = catchAsync(async (_req: Request, res: Response) => {
  const expiredCount = await PaymentService.expireAbandonedBookings();
  const remindersSent = await PaymentService.sendReminders();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Cron maintenance tasks executed successfully',
    data: { expiredCount, remindersSent },
  });
});

export const PaymentController = {
  createOrder,
  verifyPayment,
  handleWebhook,
  requestRefund,
  getPaymentHistory,
  getRefundStatus,
  triggerCronJobs,
};
