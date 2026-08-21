import { SellerMaxQualificationStatus } from '@prisma/client';
import { classifySellerMaxQualification } from './order-fulfillment.service';

describe('classifySellerMaxQualification', () => {
  const deadline = new Date('2026-08-23T10:00:00.000Z');

  it.each([
    ['one millisecond before', '2026-08-23T09:59:59.999Z'],
    ['exactly at the inclusive deadline', '2026-08-23T10:00:00.000Z'],
  ])('qualifies %s', (_label, confirmation) => {
    expect(classifySellerMaxQualification(deadline, new Date(confirmation))).toBe(
      SellerMaxQualificationStatus.QUALIFIED,
    );
  });

  it('expires one millisecond after the deadline', () => {
    expect(classifySellerMaxQualification(deadline, new Date('2026-08-23T10:00:00.001Z'))).toBe(
      SellerMaxQualificationStatus.EXPIRED,
    );
  });
});
