export const SELLER_MAX_RELEASE_CALCULATION_VERSION = 1;
export const SELLER_MAX_BLOCK_HOURS = 168;
export const SELLER_MAX_REDUCTION_HOURS_PER_BLOCK = 48;

const HOUR_MS = 60 * 60 * 1000;

export function calculateSellerMaxRelease(input: {
  deliveredAt: Date;
  frozenBaseReleaseDelayHours: number;
  buyerConfirmedAt?: Date | null;
}) {
  if (
    !Number.isSafeInteger(input.frozenBaseReleaseDelayHours) ||
    input.frozenBaseReleaseDelayHours < 0
  )
    throw new RangeError('frozenBaseReleaseDelayHours must be a non-negative safe integer');
  const blocks = Math.floor(input.frozenBaseReleaseDelayHours / SELLER_MAX_BLOCK_HOURS);
  const reductionHours = blocks * SELLER_MAX_REDUCTION_HOURS_PER_BLOCK;
  const baseReleaseEligibleAt = new Date(
    input.deliveredAt.getTime() + input.frozenBaseReleaseDelayHours * HOUR_MS,
  );
  const maxTargetAt = new Date(
    input.deliveredAt.getTime() + (input.frozenBaseReleaseDelayHours - reductionHours) * HOUR_MS,
  );
  const confirmedOrTarget = Math.max(
    maxTargetAt.getTime(),
    input.buyerConfirmedAt?.getTime() ?? maxTargetAt.getTime(),
  );
  const effectiveReleaseAt = new Date(Math.min(baseReleaseEligibleAt.getTime(), confirmedOrTarget));
  return { blocks, reductionHours, baseReleaseEligibleAt, maxTargetAt, effectiveReleaseAt };
}

type ReleaseOrder = {
  sellerPlanSnapshot: string | null;
  frozenBaseReleaseDelayHours: number | null;
  sellerMaxQualificationVersion: number | null;
  sellerMaxQualificationStatus: string | null;
  sellerMaxQualificationDeadlineAt: Date | null;
  sellerMaxQualificationDecidedAt: Date | null;
  buyerConfirmedAt: Date | null;
  sellerMaxReleaseCalculationVersion: number | null;
  sellerMaxReleaseReductionHours: number | null;
  sellerMaxReleaseTargetAt: Date | null;
  sellerMaxEffectiveReleaseAt: Date | null;
};

export function effectiveReleaseDeadline(
  order: ReleaseOrder,
  deliveredAt: Date,
  baseReleaseEligibleAt: Date,
): { valid: boolean; effectiveDueAt: Date } {
  const k = [
    order.sellerMaxReleaseCalculationVersion,
    order.sellerMaxReleaseReductionHours,
    order.sellerMaxReleaseTargetAt,
    order.sellerMaxEffectiveReleaseAt,
  ];
  if (k.every((value) => value === null))
    return { valid: true, effectiveDueAt: baseReleaseEligibleAt };
  if (
    order.sellerMaxReleaseCalculationVersion !== 1 ||
    order.sellerPlanSnapshot !== 'LIT_MAX' ||
    order.sellerMaxQualificationVersion !== 1 ||
    order.frozenBaseReleaseDelayHours === null ||
    order.sellerMaxReleaseReductionHours === null ||
    !order.sellerMaxReleaseTargetAt
  )
    return { valid: false, effectiveDueAt: baseReleaseEligibleAt };
  const expected = calculateSellerMaxRelease({
    deliveredAt,
    frozenBaseReleaseDelayHours: order.frozenBaseReleaseDelayHours,
    buyerConfirmedAt: order.buyerConfirmedAt,
  });
  if (
    expected.baseReleaseEligibleAt.getTime() !== baseReleaseEligibleAt.getTime() ||
    expected.reductionHours !== order.sellerMaxReleaseReductionHours ||
    expected.maxTargetAt.getTime() !== order.sellerMaxReleaseTargetAt.getTime()
  )
    return { valid: false, effectiveDueAt: baseReleaseEligibleAt };
  if (
    order.sellerMaxQualificationStatus === 'PENDING' &&
    order.sellerMaxEffectiveReleaseAt === null
  )
    return { valid: true, effectiveDueAt: baseReleaseEligibleAt };
  const terminal = order.sellerMaxEffectiveReleaseAt;
  if (!terminal || !order.sellerMaxQualificationDecidedAt)
    return { valid: false, effectiveDueAt: baseReleaseEligibleAt };
  const expectedEffective =
    order.sellerMaxQualificationStatus === 'QUALIFIED' &&
    order.buyerConfirmedAt &&
    order.sellerMaxQualificationDeadlineAt &&
    order.buyerConfirmedAt <= order.sellerMaxQualificationDeadlineAt
      ? expected.effectiveReleaseAt
      : order.sellerMaxQualificationStatus === 'EXPIRED'
        ? baseReleaseEligibleAt
        : null;
  return {
    valid:
      !!expectedEffective &&
      terminal.getTime() === expectedEffective.getTime() &&
      terminal <= baseReleaseEligibleAt,
    effectiveDueAt: terminal,
  };
}
