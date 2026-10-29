import { IPaymentProvider } from './IPaymentProvider';
import { RazorpayProvider } from './razorpayProvider';
import { StripeProvider } from './stripeProvider';
import config from '../../config';

let _provider: IPaymentProvider | null = null;

export function getPaymentProvider(): IPaymentProvider {
  if (_provider) return _provider;
  const providerName = (config.payment?.provider || 'razorpay').toLowerCase();
  if (providerName === 'razorpay') {
    _provider = new RazorpayProvider();
    return _provider;
  }
  if (providerName === 'stripe') {
    _provider = new StripeProvider();
    return _provider;
  }
  _provider = new RazorpayProvider();
  return _provider;
}
