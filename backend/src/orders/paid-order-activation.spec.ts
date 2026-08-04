import { readFile } from 'node:fs/promises';

describe('PaidOrderActivationService provider boundary', () => {
  it('has no PSP, provider operation, or HTTP dependency', async () => {
    const source = await readFile(__dirname + '/paid-order-activation.service.ts', 'utf8');

    expect(source).not.toMatch(
      /PaymentProviderPort|EfiPaymentProvider|https?:|getPayment|createPayment|cancelPayment|refund/,
    );
  });
});
