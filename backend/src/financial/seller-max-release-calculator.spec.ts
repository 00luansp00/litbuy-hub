import { calculateSellerMaxRelease } from './seller-max-release-calculator';

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
});
