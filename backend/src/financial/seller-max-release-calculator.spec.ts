import {
  calculateSellerMaxRelease,
  effectiveReleaseDeadline,
} from './seller-max-release-calculator';

describe('Seller MAX release calculator v1', () => {
  const deliveredAt = new Date('2026-09-01T10:00:00.000Z');
  it.each([
    [4, 4],
    [6, 6],
    [7, 5],
    [10, 8],
    [13, 11],
    [14, 10],
    [20, 16],
    [21, 15],
  ])('%dd targets %dd', (days, target) => {
    const result = calculateSellerMaxRelease({
      deliveredAt,
      frozenBaseReleaseDelayHours: days * 24,
      buyerConfirmedAt: new Date('2026-09-02T09:00:00.000Z'),
    });
    expect((result.maxTargetAt.getTime() - deliveredAt.getTime()) / 86400000).toBe(target);
    expect(result.effectiveReleaseAt.getTime()).toBeLessThanOrEqual(
      result.baseReleaseEligibleAt.getTime(),
    );
  });
  it.each([
    [0, 0],
    [167, 0],
    [168, 48],
    [169, 48],
    [335, 48],
    [336, 96],
    [503, 96],
    [504, 144],
    [505, 144],
  ])('%dh reduces %dh', (hours, reduction) => {
    expect(
      calculateSellerMaxRelease({ deliveredAt, frozenBaseReleaseDelayHours: hours }).reductionHours,
    ).toBe(reduction);
  });
  it('uses MIN(base, MAX(target, confirmation)) exactly', () => {
    const base = calculateSellerMaxRelease({
      deliveredAt,
      frozenBaseReleaseDelayHours: 168,
      buyerConfirmedAt: new Date('2026-09-20T00:00:00.000Z'),
    });
    expect(base.effectiveReleaseAt).toEqual(base.baseReleaseEligibleAt);
  });

  describe('effectiveReleaseDeadline', () => {
    const confirmedAt = new Date('2026-09-02T09:00:00.000Z');
    const calculated = calculateSellerMaxRelease({
      deliveredAt,
      frozenBaseReleaseDelayHours: 168,
      buyerConfirmedAt: confirmedAt,
    });
    const order = {
      sellerPlanSnapshot: 'LIT_MAX',
      frozenBaseReleaseDelayHours: 168,
      sellerMaxQualificationVersion: 1,
      sellerMaxQualificationStatus: 'QUALIFIED',
      sellerMaxQualificationDeadlineAt: new Date('2026-09-03T10:00:00.000Z'),
      sellerMaxQualificationDecidedAt: confirmedAt,
      buyerConfirmedAt: confirmedAt,
      sellerMaxReleaseCalculationVersion: 1,
      sellerMaxReleaseReductionHours: 48,
      sellerMaxReleaseTargetAt: calculated.maxTargetAt,
      sellerMaxEffectiveReleaseAt: calculated.effectiveReleaseAt,
    };

    it('uses base for an entirely absent legacy K snapshot', () => {
      const legacy = {
        ...order,
        sellerMaxReleaseCalculationVersion: null,
        sellerMaxReleaseReductionHours: null,
        sellerMaxReleaseTargetAt: null,
        sellerMaxEffectiveReleaseAt: null,
      };
      expect(
        effectiveReleaseDeadline(legacy, deliveredAt, calculated.baseReleaseEligibleAt),
      ).toEqual({ valid: true, effectiveDueAt: calculated.baseReleaseEligibleAt });
    });

    it('uses base for valid PENDING and EXPIRED snapshots', () => {
      const pending = {
        ...order,
        sellerMaxQualificationStatus: 'PENDING',
        sellerMaxQualificationDecidedAt: null,
        buyerConfirmedAt: null,
        sellerMaxEffectiveReleaseAt: null,
      };
      expect(
        effectiveReleaseDeadline(pending, deliveredAt, calculated.baseReleaseEligibleAt),
      ).toEqual({ valid: true, effectiveDueAt: calculated.baseReleaseEligibleAt });
      const expired = {
        ...order,
        sellerMaxQualificationStatus: 'EXPIRED',
        buyerConfirmedAt: null,
        sellerMaxEffectiveReleaseAt: calculated.baseReleaseEligibleAt,
      };
      expect(
        effectiveReleaseDeadline(expired, deliveredAt, calculated.baseReleaseEligibleAt),
      ).toEqual({ valid: true, effectiveDueAt: calculated.baseReleaseEligibleAt });
    });

    it('returns the qualified effective deadline', () => {
      expect(
        effectiveReleaseDeadline(order, deliveredAt, calculated.baseReleaseEligibleAt),
      ).toEqual({ valid: true, effectiveDueAt: calculated.effectiveReleaseAt });
    });

    it.each([
      ['partial shape', { sellerMaxReleaseReductionHours: null }],
      ['unknown version', { sellerMaxReleaseCalculationVersion: 2 }],
      ['wrong reduction', { sellerMaxReleaseReductionHours: 96 }],
      ['wrong target', { sellerMaxReleaseTargetAt: calculated.baseReleaseEligibleAt }],
      ['wrong effective', { sellerMaxEffectiveReleaseAt: calculated.baseReleaseEligibleAt }],
    ])('fails closed for %s', (_label, mutation) => {
      expect(
        effectiveReleaseDeadline(
          { ...order, ...mutation },
          deliveredAt,
          calculated.baseReleaseEligibleAt,
        ).valid,
      ).toBe(false);
    });
  });
});
