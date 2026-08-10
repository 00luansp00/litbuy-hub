import { readAlphaPaymentConfig } from './alpha-payment.config';
describe('Alpha payment configuration', () => {
  it('is opt-in and disabled by default', () =>
    expect(readAlphaPaymentConfig({ NODE_ENV: 'test' })).toEqual({ enabled: false }));
  it('enables only the explicit FAKE_ALPHA mode outside production', () =>
    expect(
      readAlphaPaymentConfig({ NODE_ENV: 'test', PAYMENT_PROVIDER_MODE: 'FAKE_ALPHA' }),
    ).toEqual({ enabled: true }));
  it('fails closed when FAKE_ALPHA is requested in production', () =>
    expect(() =>
      readAlphaPaymentConfig({ NODE_ENV: 'production', PAYMENT_PROVIDER_MODE: 'FAKE_ALPHA' }),
    ).toThrow('forbidden'));
});
