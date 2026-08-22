import { SellerMaxQualificationStatus } from '@prisma/client';
import {
  classifySellerMaxQualification,
  isSellerMaxQualificationExpired,
} from './order-fulfillment.service';

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

describe('isSellerMaxQualificationExpired', () => {
  const deadline = new Date('2026-08-23T10:00:00.000Z');

  it('does not expire at the exact inclusive deadline', () => {
    expect(isSellerMaxQualificationExpired(deadline, new Date(deadline))).toBe(false);
  });

  it('expires strictly after the deadline', () => {
    expect(isSellerMaxQualificationExpired(deadline, new Date('2026-08-23T10:00:00.001Z'))).toBe(
      true,
    );
  });
});
