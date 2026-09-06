import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { CartsService } from '../src/carts/carts.service';
import { parseIdempotencyKey } from '../src/commerce/idempotency-key';
import { CheckoutService } from '../src/checkout/checkout.service';
import { PrismaService } from '../src/database/prisma.service';
import { DisputeCoreService } from '../src/disputes/dispute-core.service';
import { DisputeFinancialDecisionService } from '../src/disputes/dispute-financial-decision.service';
import { DisputeSellerLiabilityService } from '../src/disputes/dispute-seller-liability.service';
import { DisputeRecoveryService } from '../src/financial/dispute-recovery.service';
import { FinancialLedgerService } from '../src/financial/financial-ledger.service';
import { SaleFinancialRecognitionService } from '../src/financial/sale-financial-recognition.service';
import { SellerFinanceReadService } from '../src/financial/seller-finance-read.service';
import { SellerHeldFundsReleaseService } from '../src/financial/seller-held-funds-release.service';
import { SellerHoldEligibilityService } from '../src/financial/seller-hold-eligibility.service';
import { SellerPendingHoldService } from '../src/financial/seller-pending-hold.service';
import { OrderFulfillmentService } from '../src/orders/order-fulfillment.service';
import { PaidOrderActivationService } from '../src/orders/paid-order-activation.service';
import {
  commerceFixture,
  publishPlatformCommissionPolicy,
  publishSellerReleasePolicy,
} from './order-checkout-test.helpers';

describe('AA0 DisputeFinancialDecision (real PostgreSQL)', () => {
  jest.setTimeout(120_000);
  let app: Awaited<ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>>;
  let prisma: PrismaService;
  let direct: PrismaClient;
  let carts: CartsService;
  let checkout: CheckoutService;
  let activation: PaidOrderActivationService;
  let recognition: SaleFinancialRecognitionService;
  let pending: SellerPendingHoldService;
  let eligibility: SellerHoldEligibilityService;
  let release: SellerHeldFundsReleaseService;
  let fulfillment: OrderFulfillmentService;
  let disputes: DisputeCoreService;
  let decisions: DisputeFinancialDecisionService;
  let liabilities: DisputeSellerLiabilityService;
  let finance: SellerFinanceReadService;
  let recovery: DisputeRecoveryService;
  let ledger: FinancialLedgerService;
  let version = 80_000;

  beforeAll(async () => {
    direct = new PrismaClient();
    app = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await app.init();
    prisma = app.get(PrismaService);
    carts = app.get(CartsService);
    checkout = app.get(CheckoutService);
    activation = app.get(PaidOrderActivationService);
    recognition = app.get(SaleFinancialRecognitionService);
    pending = app.get(SellerPendingHoldService);
    eligibility = app.get(SellerHoldEligibilityService);
    release = app.get(SellerHeldFundsReleaseService);
    fulfillment = app.get(OrderFulfillmentService);
    disputes = app.get(DisputeCoreService);
    decisions = app.get(DisputeFinancialDecisionService);
    liabilities = app.get(DisputeSellerLiabilityService);
    finance = app.get(SellerFinanceReadService);
    recovery = app.get(DisputeRecoveryService);
    ledger = app.get(FinancialLedgerService);
  });
  beforeEach(() => direct.$executeRawUnsafe('TRUNCATE TABLE "User", "CatalogCategory" CASCADE'));
  afterAll(async () => {
    await app.close();
    await direct.$disconnect();
  });

  async function sale(
    stage: 'ACTIVE' | 'ELIGIBLE' | 'RELEASED' = 'RELEASED',
    vip = true,
    existing?: Awaited<ReturnType<typeof commerceFixture>>,
  ) {
    const f = existing ?? (await commerceFixture(prisma, 'NORMAL', undefined, 20, false, false));
    if ((await prisma.feePolicyVersion.count({ where: { status: 'ACTIVE' } })) === 0)
      await publishPlatformCommissionPolicy(prisma, f.sellerUser.id, {
        publicVersion: version++,
        percentBps: 1000,
      });
    if ((await prisma.sellerReleasePolicyVersion.count({ where: { status: 'ACTIVE' } })) === 0)
      await publishSellerReleasePolicy(prisma, f.sellerUser.id, 0);
    const cart = await carts.add(f.buyer.id, f.seller.slug, {
      productId: f.product.id,
      quantity: 10,
      expectedVersion: 0,
    });
    const result = await checkout.create(
      f.buyer.id,
      parseIdempotencyKey(`aa0-checkout:${randomUUID()}`),
      {
        sellerSlug: f.seller.slug,
        expectedCartVersion: cart.version,
        buyerVipPlan: vip ? 'PREMIUM' : 'NONE',
        expectedPreviewFingerprint: cart.buyerVipPreviewFingerprints[vip ? 'PREMIUM' : 'NONE'],
      },
    );
    const order = await prisma.order.findUniqueOrThrow({
      where: { publicCode: (result as { orderCode: string }).orderCode },
    });
    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        amountMinor: order.totalAmountMinor,
        status: 'PAID',
        paidAt: new Date(),
      },
    });
    await prisma.paymentAttempt.create({
      data: {
        paymentId: payment.id,
        attemptNumber: 1,
        providerCode: 'LOCAL_TEST',
        status: 'SUCCEEDED',
        amountMinor: payment.amountMinor,
        externalPaymentId: `pay-${randomUUID()}`,
        idempotencyKeyHash: randomUUID(),
        requestHash: randomUUID(),
      },
    });
    await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'PENDING' } });
    await activation.processOne(order.id);
    await recognition.processOne(order.id);
    await fulfillment.makeAvailable(order.id);
    await fulfillment.recordDelivered({
      orderCode: order.publicCode,
      actorUserId: f.sellerUser.id,
      deliveryType: 'MANUAL_REFERENCE',
      evidenceHash: 'a'.repeat(64),
    });
    await fulfillment.confirmReceipt(order.publicCode, f.buyer.id);
    expect(await pending.processOne(order.id)).toBe('PROCESSED');
    const hold = await prisma.financialHold.findFirstOrThrow({ where: { orderId: order.id } });
    if (stage !== 'ACTIVE') expect(await eligibility.processOne(hold.id)).toBe('RELEASE_ELIGIBLE');
    if (stage === 'RELEASED') expect(await release.processOne(hold.id)).toBe('RELEASED');
    const admin = await prisma.user.create({
      data: {
        email: `admin-${randomUUID()}@test.local`,
        birthDate: new Date('2000-01-01'),
        status: 'ACTIVE',
        termsVersion: 't',
        termsAcceptedAt: new Date(),
        privacyVersion: 'p',
        privacyAcceptedAt: new Date(),
        roleAssignments: { create: { role: 'ADMIN' } },
      },
    });
    return {
      ...f,
      order: await prisma.order.findUniqueOrThrow({ where: { id: order.id } }),
      payment,
      hold: await prisma.financialHold.findUniqueOrThrow({ where: { id: hold.id } }),
      admin,
    };
  }

  async function buyerWin(orderId: string) {
    const c = await disputes.createCase({ orderId });
    return disputes.transition({ caseId: c.id, toStatus: 'RESOLVED_BUYER' });
  }

  const key = () => `aa0-decision:${randomUUID()}`;

  async function moveAvailableToReserved(sellerProfileId: string, amountMinor: bigint) {
    const accounts = await prisma.ledgerAccount.findMany({
      where: {
        sellerProfileId,
        purpose: { in: ['SELLER_AVAILABLE', 'SELLER_RESERVED'] },
      },
    });
    const available = accounts.find((account) => account.purpose === 'SELLER_AVAILABLE')!;
    const reserved = accounts.find((account) => account.purpose === 'SELLER_RESERVED')!;
    return ledger.post({
      type: 'TEST_LEGITIMATE_AVAILABLE_RESERVATION',
      currency: 'BRL',
      idempotencyKeyHash: randomUUID(),
      referenceType: 'SellerProfile',
      referenceId: sellerProfileId,
      entries: [
        { accountId: available.id, direction: 'DEBIT', amountMinor },
        { accountId: reserved.id, direction: 'CREDIT', amountMinor },
      ],
    });
  }

  async function moveReservedToAvailable(sellerProfileId: string, amountMinor: bigint) {
    const accounts = await prisma.ledgerAccount.findMany({
      where: { sellerProfileId, purpose: { in: ['SELLER_AVAILABLE', 'SELLER_RESERVED'] } },
    });
    return ledger.post({
      type: 'TEST_LATER_AVAILABLE_FUNDS',
      currency: 'BRL',
      idempotencyKeyHash: randomUUID(),
      entries: [
        {
          accountId: accounts.find((account) => account.purpose === 'SELLER_RESERVED')!.id,
          direction: 'DEBIT',
          amountMinor,
        },
        {
          accountId: accounts.find((account) => account.purpose === 'SELLER_AVAILABLE')!.id,
          direction: 'CREDIT',
          amountMinor,
        },
      ],
    });
  }
  const rejectionText = (results: PromiseSettledResult<unknown>[]) =>
    results
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map((result) => String(result.reason))
      .join(' ');
  const input = (
    actorUserId: string,
    disputeCaseId: string,
    amount: bigint,
    decisionType: 'TOTAL' | 'PARTIAL' = 'TOTAL',
    idempotencyKey = key(),
  ) => ({
    actorUserId,
    disputeCaseId,
    decisionType,
    decidedPrincipalAmountMinor: amount,
    idempotencyKey,
  });

  async function directInsert(
    tx: Prisma.TransactionClient | PrismaClient,
    p: {
      caseId: string;
      orderId: string;
      buyerId: string;
      sellerId: string;
      actorId: string;
      amount: bigint;
      principal?: bigint;
      type?: 'TOTAL' | 'PARTIAL';
      currency?: string;
      hash?: string;
      executableAt?: Date;
    },
  ) {
    return tx.$executeRaw`
      INSERT INTO "DisputeFinancialDecision" (id,"disputeCaseId","orderId","buyerUserId","sellerProfileId","decisionType","orderPrincipalSnapshotMinor","decidedPrincipalAmountMinor",currency,"executableAt","createdByUserId","idempotencyKeyHash","requestHash","createdAt")
      VALUES (${randomUUID()}::uuid,${p.caseId}::uuid,${p.orderId}::uuid,${p.buyerId}::uuid,${p.sellerId}::uuid,${p.type ?? 'PARTIAL'}::"DisputeFinancialDecisionType",${p.principal ?? 10000n},${p.amount},${p.currency ?? 'BRL'},${p.executableAt ?? new Date('2000-01-01')},${p.actorId}::uuid,${p.hash ?? 'a'.repeat(64)},${'b'.repeat(64)},${new Date('2000-01-01')})`;
  }

  async function liabilityAuthority(decisionId: string) {
    const decision = await prisma.disputeFinancialDecision.findUniqueOrThrow({
      where: { id: decisionId },
    });
    const components = await prisma.orderFeeComponentSnapshot.findMany({
      where: { orderId: decision.orderId, componentKind: { in: ['LISTING_TIER', 'SELLER_MAX'] } },
      orderBy: { id: 'asc' },
    });
    const prior = await prisma.disputeFinancialDecision.aggregate({
      where: {
        orderId: decision.orderId,
        OR: [
          { executableAt: { lt: decision.executableAt } },
          { executableAt: decision.executableAt, id: { lt: decision.id } },
        ],
      },
      _sum: { decidedPrincipalAmountMinor: true },
    });
    const priorPrincipal = prior._sum.decidedPrincipalAmountMinor ?? 0n;
    const allocations = components.map((component) => ({
      component,
      amount:
        (component.feeAmountMinor * (priorPrincipal + decision.decidedPrincipalAmountMinor)) /
          decision.orderPrincipalSnapshotMinor -
        (component.feeAmountMinor * priorPrincipal) / decision.orderPrincipalSnapshotMinor,
    }));
    return {
      decision,
      allocations,
      reversal: allocations.reduce((sum, allocation) => sum + allocation.amount, 0n),
    };
  }

  type LiabilityOverrides = Partial<{
    financialDecisionId: string;
    disputeCaseId: string;
    orderId: string;
    buyerUserId: string;
    sellerProfileId: string;
    principal: bigint;
    reversal: bigint;
    liability: bigint;
    currency: string;
    createdAt: Date;
  }>;

  async function directLiabilityParent(
    tx: Prisma.TransactionClient | PrismaClient,
    decisionId: string,
    overrides: LiabilityOverrides = {},
  ) {
    const authority = await liabilityAuthority(decisionId);
    const d = authority.decision;
    const id = randomUUID();
    await tx.$executeRaw`
      INSERT INTO "DisputeSellerLiability"
        (id,"disputeFinancialDecisionId","disputeCaseId","orderId","buyerUserId","sellerProfileId",
         "decisionPrincipalAmountMinor","reversiblePlatformSellerFeeRequiredAmountMinor",
         "sellerLiabilityAmountMinor",currency,"createdAt")
      VALUES
        (${id}::uuid,${overrides.financialDecisionId ?? d.id}::uuid,
         ${overrides.disputeCaseId ?? d.disputeCaseId}::uuid,${overrides.orderId ?? d.orderId}::uuid,
         ${overrides.buyerUserId ?? d.buyerUserId}::uuid,
         ${overrides.sellerProfileId ?? d.sellerProfileId}::uuid,
         ${overrides.principal ?? d.decidedPrincipalAmountMinor},
         ${overrides.reversal ?? authority.reversal},
         ${overrides.liability ?? d.decidedPrincipalAmountMinor - authority.reversal},
         ${overrides.currency ?? d.currency},${overrides.createdAt ?? new Date('2000-01-01')})`;
    return { id, ...authority };
  }

  async function directLiabilityChild(
    tx: Prisma.TransactionClient | PrismaClient,
    liabilityId: string,
    snapshot: Awaited<ReturnType<typeof liabilityAuthority>>['allocations'][number]['component'],
    amount: bigint,
    overrides: Partial<{
      snapshotId: string;
      componentKind: 'LISTING_TIER' | 'SELLER_MAX' | 'BUYER_VIP';
      originalFee: bigint;
    }> = {},
  ) {
    return tx.$executeRaw`
      INSERT INTO "DisputeSellerLiabilityFeeComponent"
        (id,"disputeSellerLiabilityId","orderFeeComponentSnapshotId","componentKind",
         "originalFrozenFeeAmountMinor","reversalRequiredAmountMinor","createdAt")
      VALUES (${randomUUID()}::uuid,${liabilityId}::uuid,
        ${overrides.snapshotId ?? snapshot.id}::uuid,
        ${overrides.componentKind ?? snapshot.componentKind}::"OrderFeeComponentKind",
        ${overrides.originalFee ?? snapshot.feeAmountMinor},${amount},${new Date('2000-01-01')})`;
  }

  async function expectReleaseEvidenceRejection(operation: Promise<unknown>) {
    try {
      await operation;
      throw new Error('expected release evidence invariant to reject the insert');
    } catch (error) {
      expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      const prismaError = error as Prisma.PrismaClientKnownRequestError;
      expect(prismaError.code).toBe('P2010');
      expect(prismaError.meta).toMatchObject({ code: '23514' });
      expect(String(prismaError.meta?.message)).toContain(
        'financial decision requires legitimate seller proceeds release',
      );
    }
  }

  it('creates TOTAL after real G1/G2 release, excludes Buyer VIP, and moves no money', async () => {
    const s = await sale('RELEASED', true);
    expect(s.order.totalAmountMinor).toBeGreaterThan(
      s.order.subtotalAmountMinor - s.order.discountAmountMinor,
    );
    const c = await buyerWin(s.order.id);
    const before = {
      tx: await prisma.ledgerTransaction.count(),
      entries: await prisma.ledgerEntry.count(),
      events: await prisma.financialEvent.count(),
      outbox: await prisma.financialOutboxEvent.count(),
      refunds: await prisma.refund.count(),
      finance: await finance.summary(s.sellerUser.id),
      fees: await prisma.orderFeeComponentSnapshot.findMany({
        where: { orderId: s.order.id },
        orderBy: { id: 'asc' },
      }),
      payment: await prisma.payment.findUniqueOrThrow({ where: { orderId: s.order.id } }),
      hold: await prisma.financialHold.findUniqueOrThrow({ where: { id: s.hold.id } }),
    };
    const principal = s.order.subtotalAmountMinor - s.order.discountAmountMinor;
    const d = await decisions.createPostReleaseBuyerDecision(input(s.admin.id, c.id, principal));
    const liability = await liabilities.createForFinancialDecision(d.id);
    expect(d).toMatchObject({
      orderId: s.order.id,
      buyerUserId: s.buyer.id,
      sellerProfileId: s.seller.id,
      orderPrincipalSnapshotMinor: principal,
      decidedPrincipalAmountMinor: principal,
      decisionType: 'TOTAL',
      currency: 'BRL',
    });
    expect(d.executableAt).toEqual(d.createdAt);
    const sellerFees = before.fees.filter((fee) =>
      ['LISTING_TIER', 'SELLER_MAX'].includes(fee.componentKind),
    );
    expect(liability.reversiblePlatformSellerFeeRequiredAmountMinor).toBe(
      sellerFees.reduce((sum, fee) => sum + fee.feeAmountMinor, 0n),
    );
    expect(liability.sellerLiabilityAmountMinor).toBe(
      principal - liability.reversiblePlatformSellerFeeRequiredAmountMinor,
    );
    expect(liability.feeComponents.map((fee) => fee.componentKind)).not.toContain('BUYER_VIP');
    await expect(liabilities.createForFinancialDecision(d.id)).resolves.toEqual(liability);
    expect({
      tx: await prisma.ledgerTransaction.count(),
      entries: await prisma.ledgerEntry.count(),
      events: await prisma.financialEvent.count(),
      outbox: await prisma.financialOutboxEvent.count(),
      refunds: await prisma.refund.count(),
      finance: await finance.summary(s.sellerUser.id),
      fees: await prisma.orderFeeComponentSnapshot.findMany({
        where: { orderId: s.order.id },
        orderBy: { id: 'asc' },
      }),
      payment: await prisma.payment.findUniqueOrThrow({ where: { orderId: s.order.id } }),
      hold: await prisma.financialHold.findUniqueOrThrow({ where: { id: s.hold.id } }),
    }).toEqual(before);
  });

  it('AA0.2 reserves released AVAILABLE once, links the claim, and derives unfunded without deficit', async () => {
    const s = await sale('RELEASED', false);
    const c = await buyerWin(s.order.id);
    const principal = s.order.subtotalAmountMinor - s.order.discountAmountMinor;
    const d = await decisions.createPostReleaseBuyerDecision(input(s.admin.id, c.id, principal));
    const liability = await liabilities.createForFinancialDecision(d.id);
    const before = await finance.summary(s.sellerUser.id);
    const result = await recovery.processForLiability(liability.id);
    expect(result).toMatchObject({
      outcome: 'CLAIM',
      claimAmountMinor: liability.sellerLiabilityAmountMinor,
      reservedAmountMinor: liability.sellerLiabilityAmountMinor,
      unfundedAmountMinor: 0n,
      status: 'FUNDED',
    });
    const claim = await prisma.disputeRecoveryClaim.findUniqueOrThrow({
      where: { disputeSellerLiabilityId: liability.id },
      include: { reservations: { include: { ledgerTransaction: { include: { entries: true } } } } },
    });
    expect(claim).toMatchObject({
      buyerUserId: s.buyer.id,
      sellerProfileId: s.seller.id,
      orderId: s.order.id,
      priorityAt: d.executableAt,
      prioritySourceId: d.id,
    });
    expect(claim.reservations).toHaveLength(1);
    expect(claim.reservations[0].ledgerTransaction).toMatchObject({
      type: 'DISPUTE_RECOVERY_RESERVED',
      referenceType: 'DisputeRecoveryClaim',
      referenceId: claim.id,
    });
    expect(claim.reservations[0].ledgerTransaction.entries).toHaveLength(2);
    const after = await finance.summary(s.sellerUser.id);
    expect(BigInt(after.balances.availableMinor)).toBe(
      BigInt(before.balances.availableMinor) - liability.sellerLiabilityAmountMinor,
    );
    expect(BigInt(after.balances.reservedMinor)).toBe(
      BigInt(before.balances.reservedMinor) + liability.sellerLiabilityAmountMinor,
    );
    expect(after.balances.pendingMinor).toBe(before.balances.pendingMinor);
    expect(after.balances.heldMinor).toBe(before.balances.heldMinor);
    expect(after.balances.deficitMinor).toBe(before.balances.deficitMinor);
    await expect(recovery.processForLiability(liability.id)).resolves.toEqual(result);
    expect(await prisma.disputeRecoveryClaim.count()).toBe(1);
    expect(await prisma.disputeRecoveryReservation.count()).toBe(1);
    expect(await prisma.refund.count()).toBe(0);
  });

  it('AA0.2 partially funds only the initial AVAILABLE and keeps the partial claim at the FIFO head', async () => {
    const s = await sale('RELEASED', false);
    const c = await buyerWin(s.order.id);
    const principal = s.order.subtotalAmountMinor - s.order.discountAmountMinor;
    const d = await decisions.createPostReleaseBuyerDecision(input(s.admin.id, c.id, principal));
    const liability = await liabilities.createForFinancialDecision(d.id);
    const initial = await finance.summary(s.sellerUser.id);
    const targetAvailable = liability.sellerLiabilityAmountMinor - 3000n;
    await moveAvailableToReserved(
      s.seller.id,
      BigInt(initial.balances.availableMinor) - targetAvailable,
    );
    const before = await finance.summary(s.sellerUser.id);
    const first = await recovery.processForLiability(liability.id);
    expect(first).toMatchObject({
      reservedAmountMinor: targetAvailable,
      unfundedAmountMinor: 3000n,
      status: 'PARTIALLY_FUNDED',
    });
    const afterInitial = await finance.summary(s.sellerUser.id);
    expect(afterInitial.balances.availableMinor).toBe('0');
    expect(afterInitial.balances.deficitMinor).toBe(before.balances.deficitMinor);

    await moveReservedToAvailable(s.seller.id, 3000n);
    await expect(recovery.processForLiability(liability.id)).resolves.toEqual(first);
    expect(await prisma.disputeRecoveryReservation.count()).toBe(1);
    expect(first.outcome).toBe('CLAIM');
    if (first.outcome !== 'CLAIM') throw new Error('expected recovery claim');
    expect(
      await prisma.ledgerTransaction.count({
        where: { type: 'DISPUTE_RECOVERY_RESERVED', referenceId: first.claimId },
      }),
    ).toBe(1);
    expect((await finance.summary(s.sellerUser.id)).balances.availableMinor).toBe('3000');
  });

  it('AA0.2 materializes an unfunded claim without touching protected or deficit buckets', async () => {
    const s = await sale('RELEASED', false);
    const c = await buyerWin(s.order.id);
    const principal = s.order.subtotalAmountMinor - s.order.discountAmountMinor;
    const d = await decisions.createPostReleaseBuyerDecision(input(s.admin.id, c.id, principal));
    const liability = await liabilities.createForFinancialDecision(d.id);
    const initial = await finance.summary(s.sellerUser.id);
    await moveAvailableToReserved(s.seller.id, BigInt(initial.balances.availableMinor));
    const before = await finance.summary(s.sellerUser.id);
    const recoveryTransactionsBefore = await prisma.ledgerTransaction.count({
      where: { type: 'DISPUTE_RECOVERY_RESERVED' },
    });
    const result = await recovery.processForLiability(liability.id);
    expect(result).toMatchObject({
      claimAmountMinor: liability.sellerLiabilityAmountMinor,
      reservedAmountMinor: 0n,
      unfundedAmountMinor: liability.sellerLiabilityAmountMinor,
      status: 'UNFUNDED',
    });
    expect(await prisma.disputeRecoveryClaim.count()).toBe(1);
    expect(await prisma.disputeRecoveryReservation.count()).toBe(0);
    expect(
      await prisma.ledgerTransaction.count({ where: { type: 'DISPUTE_RECOVERY_RESERVED' } }),
    ).toBe(recoveryTransactionsBefore);
    const after = await finance.summary(s.sellerUser.id);
    expect(after.balances.pendingMinor).toBe(before.balances.pendingMinor);
    expect(after.balances.heldMinor).toBe(before.balances.heldMinor);
    expect(after.balances.deficitMinor).toBe(before.balances.deficitMinor);
  });

  it('AA0.2 concurrent replay creates one claim, reservation and economic posting', async () => {
    const s = await sale('RELEASED', false);
    const c = await buyerWin(s.order.id);
    const principal = s.order.subtotalAmountMinor - s.order.discountAmountMinor;
    const d = await decisions.createPostReleaseBuyerDecision(input(s.admin.id, c.id, principal));
    const liability = await liabilities.createForFinancialDecision(d.id);
    const results = await Promise.all([
      recovery.processForLiability(liability.id),
      recovery.processForLiability(liability.id),
    ]);
    expect(results[0]).toEqual(results[1]);
    expect(results[0].outcome).toBe('CLAIM');
    if (results[0].outcome !== 'CLAIM') throw new Error('expected recovery claim');
    expect(await prisma.disputeRecoveryClaim.count()).toBe(1);
    expect(await prisma.disputeRecoveryReservation.count()).toBe(1);
    expect(
      await prisma.ledgerTransaction.count({
        where: { type: 'DISPUTE_RECOVERY_RESERVED', referenceId: results[0].claimId },
      }),
    ).toBe(1);
  });

  it('AA0.2 discovers the older liability when newer is called first and distributes FIFO partially', async () => {
    const firstSale = await sale('RELEASED', false);
    const secondSale = await sale('RELEASED', false, firstSale);
    const firstCase = await buyerWin(firstSale.order.id);
    const firstPrincipal =
      firstSale.order.subtotalAmountMinor - firstSale.order.discountAmountMinor;
    const firstDecision = await decisions.createPostReleaseBuyerDecision(
      input(firstSale.admin.id, firstCase.id, firstPrincipal),
    );
    const firstLiability = await liabilities.createForFinancialDecision(firstDecision.id);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const secondCase = await buyerWin(secondSale.order.id);
    const secondPrincipal =
      secondSale.order.subtotalAmountMinor - secondSale.order.discountAmountMinor;
    const secondDecision = await decisions.createPostReleaseBuyerDecision(
      input(secondSale.admin.id, secondCase.id, secondPrincipal),
    );
    const secondLiability = await liabilities.createForFinancialDecision(secondDecision.id);
    const available = BigInt(
      (await finance.summary(firstSale.sellerUser.id)).balances.availableMinor,
    );
    const secondFunding = secondLiability.sellerLiabilityAmountMinor / 2n;
    await moveAvailableToReserved(
      firstSale.seller.id,
      available - firstLiability.sellerLiabilityAmountMinor - secondFunding,
    );

    await recovery.processForLiability(secondLiability.id);
    const claims = await prisma.disputeRecoveryClaim.findMany({
      where: { sellerProfileId: firstSale.seller.id },
      include: { reservations: true },
      orderBy: [{ priorityAt: 'asc' }, { prioritySourceId: 'asc' }],
    });
    expect(claims.map((claim) => claim.disputeSellerLiabilityId)).toEqual([
      firstLiability.id,
      secondLiability.id,
    ]);
    expect(claims[0].reservations[0].amountMinor).toBe(firstLiability.sellerLiabilityAmountMinor);
    expect(claims[1].reservations[0].amountMinor).toBe(secondFunding);
    expect((await finance.summary(firstSale.sellerUser.id)).balances.availableMinor).toBe('0');
  });

  it('AA0.2 serializes concurrent claims of one Seller and preserves final FIFO', async () => {
    const firstSale = await sale('RELEASED', false);
    const secondSale = await sale('RELEASED', false, firstSale);
    const firstCase = await buyerWin(firstSale.order.id);
    const secondCase = await buyerWin(secondSale.order.id);
    const firstDecision = await decisions.createPostReleaseBuyerDecision(
      input(
        firstSale.admin.id,
        firstCase.id,
        firstSale.order.subtotalAmountMinor - firstSale.order.discountAmountMinor,
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 5));
    const secondDecision = await decisions.createPostReleaseBuyerDecision(
      input(
        secondSale.admin.id,
        secondCase.id,
        secondSale.order.subtotalAmountMinor - secondSale.order.discountAmountMinor,
      ),
    );
    const [firstLiability, secondLiability] = await Promise.all([
      liabilities.createForFinancialDecision(firstDecision.id),
      liabilities.createForFinancialDecision(secondDecision.id),
    ]);
    const results = await Promise.all([
      recovery.processForLiability(secondLiability.id),
      recovery.processForLiability(firstLiability.id),
    ]);
    expect(results.every((result) => result.outcome === 'CLAIM')).toBe(true);
    const claims = await prisma.disputeRecoveryClaim.findMany({
      where: { sellerProfileId: firstSale.seller.id },
      include: { reservations: true },
      orderBy: [{ priorityAt: 'asc' }, { prioritySourceId: 'asc' }],
    });
    expect(claims).toHaveLength(2);
    expect(claims[0].disputeSellerLiabilityId).toBe(firstLiability.id);
    expect(claims[0].reservations).toHaveLength(1);
    expect(claims[1].disputeSellerLiabilityId).toBe(secondLiability.id);
    expect(claims[1].reservations).toHaveLength(1);
  });

  it('AA0.2 processes different Sellers concurrently without crossing accounts', async () => {
    const sales = [await sale('RELEASED', false), await sale('RELEASED', false)];
    const prepared = await Promise.all(
      sales.map(async (s) => {
        const dispute = await buyerWin(s.order.id);
        const decision = await decisions.createPostReleaseBuyerDecision(
          input(s.admin.id, dispute.id, s.order.subtotalAmountMinor - s.order.discountAmountMinor),
        );
        return { s, liability: await liabilities.createForFinancialDecision(decision.id) };
      }),
    );
    await Promise.all(prepared.map((item) => recovery.processForLiability(item.liability.id)));
    const reservations = await prisma.disputeRecoveryReservation.findMany({
      include: { ledgerTransaction: { include: { entries: { include: { account: true } } } } },
    });
    expect(reservations).toHaveLength(2);
    for (const reservation of reservations)
      expect(
        reservation.ledgerTransaction.entries.every(
          (entry) => entry.account.sellerProfileId === reservation.sellerProfileId,
        ),
      ).toBe(true);
  });

  it('AA0.2 competes safely with another canonical AVAILABLE reservation', async () => {
    const s = await sale('RELEASED', false);
    const c = await buyerWin(s.order.id);
    const principal = s.order.subtotalAmountMinor - s.order.discountAmountMinor;
    const d = await decisions.createPostReleaseBuyerDecision(input(s.admin.id, c.id, principal));
    const liability = await liabilities.createForFinancialDecision(d.id);
    const initial = BigInt((await finance.summary(s.sellerUser.id)).balances.availableMinor);
    const competingAmount = (initial * 4n) / 5n;
    const accounts = await prisma.ledgerAccount.findMany({
      where: {
        sellerProfileId: s.seller.id,
        purpose: { in: ['SELLER_AVAILABLE', 'SELLER_RESERVED'] },
      },
    });
    const competing = () =>
      ledger.post({
        type: 'TEST_COMPETING_AVAILABLE_RESERVATION',
        currency: 'BRL',
        idempotencyKeyHash: randomUUID(),
        entries: [
          {
            accountId: accounts.find((x) => x.purpose === 'SELLER_AVAILABLE')!.id,
            direction: 'DEBIT',
            amountMinor: competingAmount,
          },
          {
            accountId: accounts.find((x) => x.purpose === 'SELLER_RESERVED')!.id,
            direction: 'CREDIT',
            amountMinor: competingAmount,
          },
        ],
      });
    const outcomes = await Promise.allSettled([
      recovery.processForLiability(liability.id),
      competing(),
    ]);
    const after = await finance.summary(s.sellerUser.id);
    expect(BigInt(after.balances.availableMinor)).toBeGreaterThanOrEqual(0n);
    const claim = await prisma.disputeRecoveryClaim.findUniqueOrThrow({
      where: { disputeSellerLiabilityId: liability.id },
      include: { reservations: true },
    });
    const recoveryDebit = claim.reservations[0]?.amountMinor ?? 0n;
    const competingDebit = outcomes[1].status === 'fulfilled' ? competingAmount : 0n;
    expect(recoveryDebit + competingDebit).toBeLessThanOrEqual(initial);
    for (const rejected of outcomes.filter(
      (outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected',
    ))
      expect(String(rejected.reason)).not.toMatch(/40P01|40001|P2034/);
  });

  it('AA0.2 claim and reservation authorities reject UPDATE and DELETE', async () => {
    const s = await sale('RELEASED', false);
    const c = await buyerWin(s.order.id);
    const principal = s.order.subtotalAmountMinor - s.order.discountAmountMinor;
    const d = await decisions.createPostReleaseBuyerDecision(input(s.admin.id, c.id, principal));
    const liability = await liabilities.createForFinancialDecision(d.id);
    await recovery.processForLiability(liability.id);
    const claim = await prisma.disputeRecoveryClaim.findUniqueOrThrow({
      where: { disputeSellerLiabilityId: liability.id },
      include: { reservations: true },
    });
    for (const statement of [
      `UPDATE "DisputeRecoveryClaim" SET "claimAmountMinor"="claimAmountMinor"+1 WHERE id='${claim.id}'`,
      `DELETE FROM "DisputeRecoveryClaim" WHERE id='${claim.id}'`,
      `UPDATE "DisputeRecoveryReservation" SET "amountMinor"="amountMinor"+1 WHERE id='${claim.reservations[0].id}'`,
      `DELETE FROM "DisputeRecoveryReservation" WHERE id='${claim.reservations[0].id}'`,
    ])
      await expect(direct.$executeRawUnsafe(statement)).rejects.toBeDefined();
  });

  it('AA0.2 rejects direct claim authority forgery', async () => {
    const s = await sale('RELEASED', false);
    const c = await buyerWin(s.order.id);
    const principal = s.order.subtotalAmountMinor - s.order.discountAmountMinor;
    const d = await decisions.createPostReleaseBuyerDecision(input(s.admin.id, c.id, principal));
    const liability = await liabilities.createForFinancialDecision(d.id);
    const valid = {
      liabilityId: liability.id,
      decisionId: d.id,
      caseId: c.id,
      orderId: s.order.id,
      buyerId: s.buyer.id,
      sellerId: s.seller.id,
      amount: liability.sellerLiabilityAmountMinor,
      currency: 'BRL',
      priorityAt: d.executableAt,
      prioritySourceId: d.id,
    };
    const attempt = (override: Partial<typeof valid>) => {
      const value = { ...valid, ...override };
      return direct.$executeRaw`
        INSERT INTO "DisputeRecoveryClaim"
          (id,"disputeSellerLiabilityId","disputeFinancialDecisionId","disputeCaseId","orderId",
           "buyerUserId","sellerProfileId","claimAmountMinor",currency,"priorityAt","prioritySourceId")
        VALUES (${randomUUID()}::uuid,${value.liabilityId}::uuid,${value.decisionId}::uuid,
          ${value.caseId}::uuid,${value.orderId}::uuid,${value.buyerId}::uuid,
          ${value.sellerId}::uuid,${value.amount},${value.currency},${value.priorityAt},
          ${value.prioritySourceId}::uuid)`;
    };
    for (const forgery of [
      { liabilityId: randomUUID() },
      { decisionId: randomUUID() },
      { caseId: randomUUID() },
      { orderId: randomUUID() },
      { buyerId: randomUUID() },
      { sellerId: randomUUID() },
      { amount: liability.sellerLiabilityAmountMinor + 1n },
      { amount: 0n },
      { amount: -1n },
      { currency: 'USD' },
      { priorityAt: new Date(d.executableAt.getTime() + 1) },
      { prioritySourceId: randomUUID() },
    ])
      await expect(attempt(forgery)).rejects.toBeDefined();
    expect(await prisma.disputeRecoveryClaim.count()).toBe(0);
  });

  it('AA0.2 defers Ledger correlation to commit and rejects an orphan atomically', async () => {
    const s = await sale('RELEASED', false);
    const c = await buyerWin(s.order.id);
    const principal = s.order.subtotalAmountMinor - s.order.discountAmountMinor;
    const d = await decisions.createPostReleaseBuyerDecision(input(s.admin.id, c.id, principal));
    const liability = await liabilities.createForFinancialDecision(d.id);
    const before = {
      transactions: await prisma.ledgerTransaction.count(),
      entries: await prisma.ledgerEntry.count(),
      events: await prisma.financialEvent.count(),
      outbox: await prisma.financialOutboxEvent.count(),
    };
    const accounts = await prisma.ledgerAccount.findMany({
      where: {
        sellerProfileId: s.seller.id,
        purpose: { in: ['SELLER_AVAILABLE', 'SELLER_RESERVED'] },
      },
    });
    await expect(
      prisma.$transaction((tx) =>
        ledger.postWithOutcomeInTransaction(tx, {
          type: 'DISPUTE_RECOVERY_RESERVED',
          currency: 'BRL',
          idempotencyKeyHash: randomUUID(),
          referenceType: 'DisputeRecoveryClaim',
          referenceId: randomUUID(),
          entries: [
            {
              accountId: accounts.find((x) => x.purpose === 'SELLER_AVAILABLE')!.id,
              direction: 'DEBIT',
              amountMinor: 1n,
            },
            {
              accountId: accounts.find((x) => x.purpose === 'SELLER_RESERVED')!.id,
              direction: 'CREDIT',
              amountMinor: 1n,
            },
          ],
          emitOutbox: true,
        }),
      ),
    ).rejects.toThrow(/matching recovery reservation/);
    expect({
      transactions: await prisma.ledgerTransaction.count(),
      entries: await prisma.ledgerEntry.count(),
      events: await prisma.financialEvent.count(),
      outbox: await prisma.financialOutboxEvent.count(),
    }).toEqual(before);
    await expect(recovery.processForLiability(liability.id)).resolves.toMatchObject({
      status: 'FUNDED',
    });
  });

  it('AA0.2 rejects forged reservation correlations and incompatible postings', async () => {
    const s = await sale('RELEASED', false);
    const c = await buyerWin(s.order.id);
    const principal = s.order.subtotalAmountMinor - s.order.discountAmountMinor;
    const d = await decisions.createPostReleaseBuyerDecision(input(s.admin.id, c.id, principal));
    const liability = await liabilities.createForFinancialDecision(d.id);
    const balance = await finance.summary(s.sellerUser.id);
    await moveAvailableToReserved(s.seller.id, BigInt(balance.balances.availableMinor));
    const result = await recovery.processForLiability(liability.id);
    if (result.outcome !== 'CLAIM') throw new Error('expected recovery claim');
    await moveReservedToAvailable(s.seller.id, 10n);
    const accounts = await prisma.ledgerAccount.findMany({
      where: {
        sellerProfileId: s.seller.id,
        purpose: { in: ['SELLER_AVAILABLE', 'SELLER_RESERVED'] },
      },
    });
    const availableId = accounts.find((x) => x.purpose === 'SELLER_AVAILABLE')!.id;
    const reservedId = accounts.find((x) => x.purpose === 'SELLER_RESERVED')!.id;
    const variants = [
      { type: 'WRONG_TYPE' },
      { referenceType: 'WrongReference' },
      { referenceId: randomUUID() },
      { reservationAmount: 2n },
      { sellerProfileId: randomUUID() },
      { fundingSource: 'TOP_UP' },
      { inverted: true },
      { extraEntry: true },
    ];
    for (const variant of variants)
      await expect(
        prisma.$transaction(async (tx) => {
          const posted = await ledger.postWithOutcomeInTransaction(tx, {
            type: variant.type ?? 'DISPUTE_RECOVERY_RESERVED',
            currency: 'BRL',
            idempotencyKeyHash: randomUUID(),
            referenceType: variant.referenceType ?? 'DisputeRecoveryClaim',
            referenceId: variant.referenceId ?? result.claimId,
            entries: [
              {
                accountId: variant.inverted ? reservedId : availableId,
                direction: 'DEBIT',
                amountMinor: 1n,
              },
              {
                accountId: variant.inverted ? availableId : reservedId,
                direction: 'CREDIT',
                amountMinor: 1n,
              },
              ...(variant.extraEntry
                ? [{ accountId: reservedId, direction: 'CREDIT' as const, amountMinor: 1n }]
                : []),
            ],
          });
          await tx.disputeRecoveryReservation.create({
            data: {
              recoveryClaimId: result.claimId,
              sellerProfileId: variant.sellerProfileId ?? s.seller.id,
              ledgerTransactionId: posted.transaction.id,
              amountMinor: variant.reservationAmount ?? 1n,
              fundingSource: variant.fundingSource ?? 'AVAILABLE_BALANCE',
            },
          });
        }),
      ).rejects.toBeDefined();
    expect(await prisma.disputeRecoveryReservation.count()).toBe(0);
  });

  it('AA0.2 database guard rejects direct SQL economic bypass of an older unfunded claim', async () => {
    const firstSale = await sale('RELEASED', false);
    const secondSale = await sale('RELEASED', false, firstSale);
    const firstCase = await buyerWin(firstSale.order.id);
    const secondCase = await buyerWin(secondSale.order.id);
    const firstDecision = await decisions.createPostReleaseBuyerDecision(
      input(
        firstSale.admin.id,
        firstCase.id,
        firstSale.order.subtotalAmountMinor - firstSale.order.discountAmountMinor,
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 5));
    const secondDecision = await decisions.createPostReleaseBuyerDecision(
      input(
        secondSale.admin.id,
        secondCase.id,
        secondSale.order.subtotalAmountMinor - secondSale.order.discountAmountMinor,
      ),
    );
    const firstLiability = await liabilities.createForFinancialDecision(firstDecision.id);
    const secondLiability = await liabilities.createForFinancialDecision(secondDecision.id);
    const available = BigInt(
      (await finance.summary(firstSale.sellerUser.id)).balances.availableMinor,
    );
    await moveAvailableToReserved(firstSale.seller.id, available);
    await recovery.processForLiability(secondLiability.id);
    await moveReservedToAvailable(firstSale.seller.id, 1n);
    const claims = await prisma.disputeRecoveryClaim.findMany({
      where: { sellerProfileId: firstSale.seller.id },
      orderBy: [{ priorityAt: 'asc' }, { prioritySourceId: 'asc' }],
    });
    expect(claims.map((claim) => claim.disputeSellerLiabilityId)).toEqual([
      firstLiability.id,
      secondLiability.id,
    ]);
    const accounts = await prisma.ledgerAccount.findMany({
      where: {
        sellerProfileId: firstSale.seller.id,
        purpose: { in: ['SELLER_AVAILABLE', 'SELLER_RESERVED'] },
      },
    });
    await expect(
      prisma.$transaction(async (tx) => {
        const posted = await ledger.postWithOutcomeInTransaction(tx, {
          type: 'DISPUTE_RECOVERY_RESERVED',
          currency: 'BRL',
          idempotencyKeyHash: randomUUID(),
          referenceType: 'DisputeRecoveryClaim',
          referenceId: claims[1].id,
          entries: [
            {
              accountId: accounts.find((x) => x.purpose === 'SELLER_AVAILABLE')!.id,
              direction: 'DEBIT',
              amountMinor: 1n,
            },
            {
              accountId: accounts.find((x) => x.purpose === 'SELLER_RESERVED')!.id,
              direction: 'CREDIT',
              amountMinor: 1n,
            },
          ],
        });
        await tx.disputeRecoveryReservation.create({
          data: {
            recoveryClaimId: claims[1].id,
            sellerProfileId: firstSale.seller.id,
            ledgerTransactionId: posted.transaction.id,
            amountMinor: 1n,
          },
        });
      }),
    ).rejects.toThrow(/FIFO priority violation/);
    expect(await prisma.disputeRecoveryReservation.count()).toBe(0);
  });

  it.each(['ACTIVE', 'ELIGIBLE'] as const)(
    'rejects %s proceeds before legitimate release',
    async (stage) => {
      const s = await sale(stage, false);
      const c = await buyerWin(s.order.id);
      await expect(
        decisions.createPostReleaseBuyerDecision(input(s.admin.id, c.id, 10000n)),
      ).rejects.toMatchObject({ code: 'FINANCIAL_DECISION_POST_RELEASE_REQUIRED' });
    },
  );

  it.each(['OPEN', 'UNDER_REVIEW', 'RESOLVED_SELLER', 'CLOSED'] as const)(
    'rejects dispute status %s',
    async (status) => {
      const s = await sale();
      let c = await disputes.createCase({ orderId: s.order.id });
      if (status !== 'OPEN') c = await disputes.transition({ caseId: c.id, toStatus: status });
      await expect(
        decisions.createPostReleaseBuyerDecision(input(s.admin.id, c.id, 5000n, 'PARTIAL')),
      ).rejects.toMatchObject({ code: 'FINANCIAL_DECISION_DISPUTE_INELIGIBLE' });
    },
  );

  it('requires ADMIN for Buyer, Seller and direct SQL while ADMIN succeeds', async () => {
    const s = await sale();
    const c = await buyerWin(s.order.id);
    for (const actorUserId of [s.buyer.id, s.sellerUser.id])
      await expect(
        decisions.createPostReleaseBuyerDecision(input(actorUserId, c.id, 5000n, 'PARTIAL')),
      ).rejects.toMatchObject({ code: 'FINANCIAL_DECISION_ADMIN_REQUIRED' });
    await expect(
      directInsert(direct, {
        caseId: c.id,
        orderId: s.order.id,
        buyerId: s.buyer.id,
        sellerId: s.seller.id,
        actorId: s.buyer.id,
        amount: 5000n,
      }),
    ).rejects.toBeDefined();
    await expect(
      decisions.createPostReleaseBuyerDecision(input(s.admin.id, c.id, 5000n, 'PARTIAL')),
    ).resolves.toMatchObject({ decidedPrincipalAmountMinor: 5000n });
  });

  it.each([
    ['TOTAL', 9999n],
    ['PARTIAL', 10000n],
    ['PARTIAL', 0n],
    ['PARTIAL', -1n],
    ['PARTIAL', 10001n],
  ] as const)('rejects invalid %s amount %s', async (type, amount) => {
    const s = await sale();
    const c = await buyerWin(s.order.id);
    await expect(
      decisions.createPostReleaseBuyerDecision(input(s.admin.id, c.id, amount, type)),
    ).rejects.toMatchObject({ code: 'FINANCIAL_DECISION_INVALID_AMOUNT' });
  });

  it('accepts sequential historical 4000 + 6000 and rejects the next positive amount', async () => {
    const s = await sale();
    const a = await buyerWin(s.order.id);
    const da = await decisions.createPostReleaseBuyerDecision(
      input(s.admin.id, a.id, 4000n, 'PARTIAL'),
    );
    const la = await liabilities.createForFinancialDecision(da.id);
    const b = await buyerWin(s.order.id);
    const db = await decisions.createPostReleaseBuyerDecision(
      input(s.admin.id, b.id, 6000n, 'PARTIAL'),
    );
    const lb = await liabilities.createForFinancialDecision(db.id);
    expect(
      la.reversiblePlatformSellerFeeRequiredAmountMinor +
        lb.reversiblePlatformSellerFeeRequiredAmountMinor,
    ).toBe(
      (
        await prisma.orderFeeComponentSnapshot.aggregate({
          where: { orderId: s.order.id, componentKind: { in: ['LISTING_TIER', 'SELLER_MAX'] } },
          _sum: { feeAmountMinor: true },
        })
      )._sum.feeAmountMinor,
    );
    const c = await buyerWin(s.order.id);
    await expect(
      decisions.createPostReleaseBuyerDecision(input(s.admin.id, c.id, 1n, 'PARTIAL')),
    ).rejects.toMatchObject({ code: 'FINANCIAL_DECISION_CUMULATIVE_LIMIT_EXCEEDED' });
    expect(
      (
        await prisma.disputeFinancialDecision.aggregate({
          where: { orderId: s.order.id },
          _sum: { decidedPrincipalAmountMinor: true },
        })
      )._sum.decidedPrincipalAmountMinor,
    ).toBe(10000n);
  });

  it('serializes service × service at the Order boundary without leaking 40001/deadlock', async () => {
    const s = await sale();
    const a = await buyerWin(s.order.id);
    const b = await buyerWin(s.order.id);
    const results = await Promise.allSettled([
      decisions.createPostReleaseBuyerDecision(input(s.admin.id, a.id, 6000n, 'PARTIAL')),
      decisions.createPostReleaseBuyerDecision(input(s.admin.id, b.id, 6000n, 'PARTIAL')),
    ]);
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(rejectionText(results)).not.toMatch(/40001|40P01|deadlock/i);
    expect(
      (
        await prisma.disputeFinancialDecision.aggregate({
          where: { orderId: s.order.id },
          _sum: { decidedPrincipalAmountMinor: true },
        })
      )._sum.decidedPrincipalAmountMinor,
    ).toBe(6000n);
  });

  it('serializes service × direct insert without deadlock or cumulative overflow', async () => {
    const s = await sale();
    const a = await buyerWin(s.order.id);
    const b = await buyerWin(s.order.id);
    const results = await Promise.allSettled([
      decisions.createPostReleaseBuyerDecision(input(s.admin.id, a.id, 6000n, 'PARTIAL')),
      direct.$transaction(
        (tx) =>
          directInsert(tx, {
            caseId: b.id,
            orderId: s.order.id,
            buyerId: s.buyer.id,
            sellerId: s.seller.id,
            actorId: s.admin.id,
            amount: 6000n,
            hash: 'c'.repeat(64),
          }),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    ]);
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(rejectionText(results)).not.toMatch(/40P01|deadlock/i);
    expect(
      (
        await prisma.disputeFinancialDecision.aggregate({
          where: { orderId: s.order.id },
          _sum: { decidedPrincipalAmountMinor: true },
        })
      )._sum.decidedPrincipalAmountMinor,
    ).toBe(6000n);
  });

  it('provides permanent idempotency, key reuse conflict, same-case conflict and concurrent replay', async () => {
    const s = await sale();
    const c = await buyerWin(s.order.id);
    const k = key();
    const request = input(s.admin.id, c.id, 5000n, 'PARTIAL', k);
    const [a, b] = await Promise.all([
      decisions.createPostReleaseBuyerDecision(request),
      decisions.createPostReleaseBuyerDecision(request),
    ]);
    expect(a.id).toBe(b.id);
    expect(await prisma.disputeFinancialDecision.count()).toBe(1);
    await expect(
      decisions.createPostReleaseBuyerDecision({ ...request, decidedPrincipalAmountMinor: 4000n }),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
    await expect(
      decisions.createPostReleaseBuyerDecision({
        ...request,
        decisionType: 'TOTAL',
        decidedPrincipalAmountMinor: 10000n,
      }),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
    await expect(
      decisions.createPostReleaseBuyerDecision({ ...request, idempotencyKey: key() }),
    ).rejects.toMatchObject({ code: 'FINANCIAL_DECISION_ALREADY_EXISTS' });
  });

  it('fails closed on direct SQL parties, snapshot, currency, hashes, release and amount shape', async () => {
    const s = await sale();
    const c = await buyerWin(s.order.id);
    const other = await prisma.user.create({
      data: {
        email: `other-${randomUUID()}@test`,
        birthDate: new Date('2000-01-01'),
        status: 'ACTIVE',
        termsVersion: 't',
        termsAcceptedAt: new Date(),
        privacyVersion: 'p',
        privacyAcceptedAt: new Date(),
      },
    });
    const base = {
      caseId: c.id,
      orderId: s.order.id,
      buyerId: s.buyer.id,
      sellerId: s.seller.id,
      actorId: s.admin.id,
      amount: 5000n,
    };
    for (const bad of [
      { ...base, buyerId: other.id },
      { ...base, principal: 9999n },
      { ...base, currency: 'USD' },
      { ...base, hash: 'bad' },
      { ...base, type: 'TOTAL' as const },
    ])
      await expect(directInsert(direct, bad)).rejects.toBeDefined();
    const pre = await sale('ELIGIBLE', false);
    const pc = await buyerWin(pre.order.id);
    await expectReleaseEvidenceRejection(
      directInsert(direct, {
        caseId: pc.id,
        orderId: pre.order.id,
        buyerId: pre.buyer.id,
        sellerId: pre.seller.id,
        actorId: pre.admin.id,
        amount: 5000n,
      }),
    );
  });

  it('prevents inconsistent RELEASED evidence and rejects the unreleased decision', async () => {
    const s = await sale('ELIGIBLE', false);
    const c = await buyerWin(s.order.id);
    const unrelatedPosting = await prisma.ledgerTransaction.findFirstOrThrow({
      where: { type: 'SALE_RECOGNIZED', referenceId: s.order.id },
    });
    await expect(
      prisma.$executeRaw`
        UPDATE "FinancialHold"
        SET status = 'RELEASED', "releasedAt" = transaction_timestamp(),
            "releaseLedgerTransactionId" = ${unrelatedPosting.id}::uuid
        WHERE id = ${s.hold.id}::uuid
      `,
    ).rejects.toMatchObject({
      code: 'P2010',
      meta: expect.objectContaining({
        code: '23514',
        message: expect.stringContaining('FINANCIAL_HOLD_RELEASE_POSTING_INVALID'),
      }),
    });
    await expectReleaseEvidenceRejection(
      directInsert(direct, {
        caseId: c.id,
        orderId: s.order.id,
        buyerId: s.buyer.id,
        sellerId: s.seller.id,
        actorId: s.admin.id,
        amount: 5000n,
      }),
    );
  });

  it.each(['OPEN', 'UNDER_REVIEW', 'RESOLVED_SELLER', 'CLOSED'] as const)(
    'rejects direct SQL for dispute status %s',
    async (status) => {
      const s = await sale();
      let c = await disputes.createCase({ orderId: s.order.id });
      if (status !== 'OPEN') c = await disputes.transition({ caseId: c.id, toStatus: status });
      await expect(
        directInsert(direct, {
          caseId: c.id,
          orderId: s.order.id,
          buyerId: s.buyer.id,
          sellerId: s.seller.id,
          actorId: s.admin.id,
          amount: 5000n,
        }),
      ).rejects.toBeDefined();
    },
  );

  it('overrides caller timestamps and rejects every UPDATE and DELETE', async () => {
    const s = await sale();
    const c = await buyerWin(s.order.id);
    const ancient = new Date('2000-01-01');
    await directInsert(direct, {
      caseId: c.id,
      orderId: s.order.id,
      buyerId: s.buyer.id,
      sellerId: s.seller.id,
      actorId: s.admin.id,
      amount: 5000n,
      executableAt: ancient,
    });
    const d = await prisma.disputeFinancialDecision.findUniqueOrThrow({
      where: { disputeCaseId: c.id },
    });
    expect(d.executableAt).toEqual(d.createdAt);
    expect(d.executableAt).not.toEqual(ancient);
    for (const sql of [
      `UPDATE "DisputeFinancialDecision" SET "decidedPrincipalAmountMinor"=1 WHERE id='${d.id}'::uuid`,
      `UPDATE "DisputeFinancialDecision" SET "createdByUserId"='${s.buyer.id}'::uuid WHERE id='${d.id}'::uuid`,
      `UPDATE "DisputeFinancialDecision" SET "executableAt"=CURRENT_TIMESTAMP WHERE id='${d.id}'::uuid`,
      `UPDATE "DisputeFinancialDecision" SET "requestHash"='${'c'.repeat(64)}' WHERE id='${d.id}'::uuid`,
      `DELETE FROM "DisputeFinancialDecision" WHERE id='${d.id}'::uuid`,
    ])
      await expect(direct.$executeRawUnsafe(sql)).rejects.toBeDefined();
  });

  it('fails closed for unresolved legacy fees through the service and direct SQL', async () => {
    const s = await sale();
    const c = await buyerWin(s.order.id);
    const d = await decisions.createPostReleaseBuyerDecision(
      input(s.admin.id, c.id, 5000n, 'PARTIAL'),
    );
    // Controlled corruption fixture: earlier PostgreSQL guards make a modern snapshot immutable.
    await direct.$executeRawUnsafe(
      'ALTER TABLE "Order" DISABLE TRIGGER "Order_pricing_snapshot_immutable"',
    );
    try {
      await direct.order.update({ where: { id: s.order.id }, data: { feeSnapshotVersion: null } });
    } finally {
      await direct.$executeRawUnsafe(
        'ALTER TABLE "Order" ENABLE TRIGGER "Order_pricing_snapshot_immutable"',
      );
    }
    await expect(liabilities.createForFinancialDecision(d.id)).rejects.toMatchObject({
      code: 'SELLER_LIABILITY_LEGACY_FEE_UNRESOLVED',
    });
    await expect(directLiabilityParent(direct, d.id)).rejects.toMatchObject({
      code: 'P2010',
      meta: expect.objectContaining({
        code: '23514',
        message: expect.stringContaining('SELLER_LIABILITY_LEGACY_FEE_UNRESOLVED'),
      }),
    });
    expect(await prisma.disputeSellerLiability.count()).toBe(0);
  });

  it('proves cumulative PostgreSQL rounding with remainder over 3333 + 3333 + 3334', async () => {
    const s = await sale('RELEASED', false);
    const frozen = await prisma.orderFeeComponentSnapshot.findMany({
      where: { orderId: s.order.id, componentKind: { in: ['LISTING_TIER', 'SELLER_MAX'] } },
      orderBy: { id: 'asc' },
    });
    const amounts = [3333n, 3333n, 3334n];
    let prior = 0n;
    const seen = new Map<string, bigint>();
    for (const amount of amounts) {
      const c = await buyerWin(s.order.id);
      const d = await decisions.createPostReleaseBuyerDecision(
        input(s.admin.id, c.id, amount, 'PARTIAL'),
      );
      const liability = await liabilities.createForFinancialDecision(d.id);
      expect(liability.sellerLiabilityAmountMinor).toBe(
        amount - liability.reversiblePlatformSellerFeeRequiredAmountMinor,
      );
      for (const fee of liability.feeComponents) {
        const original = frozen.find(
          (snapshot) => snapshot.id === fee.orderFeeComponentSnapshotId,
        )!;
        const expected =
          (original.feeAmountMinor * (prior + amount)) / 10000n -
          (original.feeAmountMinor * prior) / 10000n;
        expect(fee.reversalRequiredAmountMinor).toBe(expected);
        seen.set(original.id, (seen.get(original.id) ?? 0n) + fee.reversalRequiredAmountMinor);
        expect(seen.get(original.id)).toBeLessThanOrEqual(original.feeAmountMinor);
      }
      prior += amount;
    }
    expect(prior).toBe(10000n);
    for (const snapshot of frozen) expect(seen.get(snapshot.id)).toBe(snapshot.feeAmountMinor);
  });

  it('rejects direct parent party, linkage, principal, currency and calculated amount forgery', async () => {
    const s = await sale();
    const c = await buyerWin(s.order.id);
    const d = await decisions.createPostReleaseBuyerDecision(
      input(s.admin.id, c.id, 5000n, 'PARTIAL'),
    );
    const other = await sale();
    const authority = await liabilityAuthority(d.id);
    const invalid: LiabilityOverrides[] = [
      { buyerUserId: other.buyer.id },
      { sellerProfileId: other.seller.id },
      { orderId: other.order.id },
      { disputeCaseId: (await buyerWin(other.order.id)).id },
      { principal: d.decidedPrincipalAmountMinor - 1n },
      { reversal: authority.reversal - 1n },
      { reversal: authority.reversal + 1n },
      { liability: d.decidedPrincipalAmountMinor - authority.reversal + 1n },
      { liability: -1n },
      { currency: 'USD' },
    ];
    for (const overrides of invalid)
      await expect(directLiabilityParent(direct, d.id, overrides)).rejects.toBeDefined();
    expect(await prisma.disputeSellerLiability.count({ where: { orderId: s.order.id } })).toBe(0);
  });

  it('enforces parent and child append-only triggers for every authority field', async () => {
    const s = await sale();
    const c = await buyerWin(s.order.id);
    const d = await decisions.createPostReleaseBuyerDecision(
      input(s.admin.id, c.id, 5000n, 'PARTIAL'),
    );
    const liability = await liabilities.createForFinancialDecision(d.id);
    const child = liability.feeComponents[0];
    const parentUpdates = [
      `"sellerLiabilityAmountMinor"=0`,
      `"reversiblePlatformSellerFeeRequiredAmountMinor"=0`,
      `"decisionPrincipalAmountMinor"=1`,
      `"buyerUserId"='${s.admin.id}'::uuid`,
      `"sellerProfileId"='${randomUUID()}'::uuid`,
      `"createdAt"=CURRENT_TIMESTAMP`,
    ];
    for (const update of parentUpdates)
      await expect(
        direct.$executeRawUnsafe(
          `UPDATE "DisputeSellerLiability" SET ${update} WHERE id='${liability.id}'::uuid`,
        ),
      ).rejects.toBeDefined();
    const childUpdates = [
      `"reversalRequiredAmountMinor"=0`,
      `"originalFrozenFeeAmountMinor"=0`,
      `"orderFeeComponentSnapshotId"='${randomUUID()}'::uuid`,
      `"componentKind"='BUYER_VIP'`,
    ];
    for (const update of childUpdates)
      await expect(
        direct.$executeRawUnsafe(
          `UPDATE "DisputeSellerLiabilityFeeComponent" SET ${update} WHERE id='${child.id}'::uuid`,
        ),
      ).rejects.toBeDefined();
    await expect(
      direct.$executeRawUnsafe(
        `DELETE FROM "DisputeSellerLiabilityFeeComponent" WHERE id='${child.id}'::uuid`,
      ),
    ).rejects.toBeDefined();
    await expect(
      direct.$executeRawUnsafe(
        `DELETE FROM "DisputeSellerLiability" WHERE id='${liability.id}'::uuid`,
      ),
    ).rejects.toBeDefined();
  });

  it('rejects forged children, Buyer VIP reversal, and incomplete deferred breakdown at COMMIT', async () => {
    const s = await sale('RELEASED', true);
    const c = await buyerWin(s.order.id);
    const d = await decisions.createPostReleaseBuyerDecision(
      input(s.admin.id, c.id, 5000n, 'PARTIAL'),
    );
    const authority = await liabilityAuthority(d.id);
    const sellerFee = authority.allocations[0];
    const vip = await prisma.orderFeeComponentSnapshot.findFirstOrThrow({
      where: { orderId: s.order.id, componentKind: 'BUYER_VIP' },
    });
    const other = await sale('RELEASED', false);
    const otherSnapshot = await prisma.orderFeeComponentSnapshot.findFirstOrThrow({
      where: { orderId: other.order.id, componentKind: 'LISTING_TIER' },
    });
    const invalidChildren = [
      { snapshotId: otherSnapshot.id },
      { componentKind: 'SELLER_MAX' as const },
      { originalFee: sellerFee.component.feeAmountMinor + 1n },
    ];
    for (const overrides of invalidChildren)
      await expect(
        direct.$transaction(async (tx) => {
          const parent = await directLiabilityParent(tx, d.id);
          await directLiabilityChild(
            tx,
            parent.id,
            sellerFee.component,
            sellerFee.amount,
            overrides,
          );
        }),
      ).rejects.toBeDefined();
    await expect(
      direct.$transaction(async (tx) => {
        const parent = await directLiabilityParent(tx, d.id);
        await directLiabilityChild(tx, parent.id, sellerFee.component, sellerFee.amount + 1n);
      }),
    ).rejects.toBeDefined();
    await expect(
      direct.$transaction(async (tx) => {
        const parent = await directLiabilityParent(tx, d.id);
        await directLiabilityChild(tx, parent.id, vip, 0n, { componentKind: 'BUYER_VIP' });
      }),
    ).rejects.toBeDefined();
    await expect(
      direct.$transaction(async (tx) => {
        await directLiabilityParent(tx, d.id);
        // The INSERT is accepted here; the deferred constraint must reject COMMIT.
      }),
    ).rejects.toThrow('seller liability fee breakdown incomplete');
    expect(await prisma.disputeSellerLiability.count({ where: { orderId: s.order.id } })).toBe(0);
  });

  it('serializes concurrent same-decision replay without duplicate rows or raw retry errors', async () => {
    const s = await sale();
    const c = await buyerWin(s.order.id);
    const d = await decisions.createPostReleaseBuyerDecision(
      input(s.admin.id, c.id, 5000n, 'PARTIAL'),
    );
    const results = await Promise.allSettled([
      liabilities.createForFinancialDecision(d.id),
      liabilities.createForFinancialDecision(d.id),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(2);
    expect(rejectionText(results)).not.toMatch(/40001|40P01|deadlock/i);
    const fulfilled = results.filter(
      (
        result,
      ): result is PromiseFulfilledResult<
        Awaited<ReturnType<typeof liabilities.createForFinancialDecision>>
      > => result.status === 'fulfilled',
    );
    expect(fulfilled[0].value.id).toBe(fulfilled[1].value.id);
    expect(await prisma.disputeSellerLiability.count({ where: { orderId: s.order.id } })).toBe(1);
    expect(
      await prisma.disputeSellerLiabilityFeeComponent.count({
        where: { disputeSellerLiabilityId: fulfilled[0].value.id },
      }),
    ).toBe(fulfilled[0].value.feeComponents.length);
  });

  it('serializes different historical liabilities on one Order and preserves snapshot/non-effects', async () => {
    const s = await sale();
    const a = await buyerWin(s.order.id);
    const da = await decisions.createPostReleaseBuyerDecision(
      input(s.admin.id, a.id, 3333n, 'PARTIAL'),
    );
    const b = await buyerWin(s.order.id);
    const db = await decisions.createPostReleaseBuyerDecision(
      input(s.admin.id, b.id, 6667n, 'PARTIAL'),
    );
    const before = {
      ledgerTransactions: await prisma.ledgerTransaction.count(),
      ledgerEntries: await prisma.ledgerEntry.count(),
      events: await prisma.financialEvent.count(),
      outbox: await prisma.financialOutboxEvent.count(),
      refunds: await prisma.refund.count(),
      holds: await prisma.financialHold.findMany({ where: { orderId: s.order.id } }),
      payment: await prisma.payment.findUniqueOrThrow({ where: { orderId: s.order.id } }),
      order: await prisma.order.findUniqueOrThrow({ where: { id: s.order.id } }),
      finance: await finance.summary(s.sellerUser.id),
      snapshots: await prisma.orderFeeComponentSnapshot.findMany({
        where: { orderId: s.order.id },
        orderBy: { id: 'asc' },
      }),
    };
    const results = await Promise.allSettled([
      liabilities.createForFinancialDecision(da.id),
      liabilities.createForFinancialDecision(db.id),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(2);
    expect(rejectionText(results)).not.toMatch(/40001|40P01|deadlock/i);
    expect(await prisma.disputeSellerLiability.count({ where: { orderId: s.order.id } })).toBe(2);
    for (const snapshot of before.snapshots.filter((fee) => fee.componentKind !== 'BUYER_VIP')) {
      const allocated = await prisma.disputeSellerLiabilityFeeComponent.aggregate({
        where: { orderFeeComponentSnapshotId: snapshot.id },
        _sum: { reversalRequiredAmountMinor: true },
      });
      expect(allocated._sum.reversalRequiredAmountMinor).toBe(snapshot.feeAmountMinor);
    }
    expect({
      ledgerTransactions: await prisma.ledgerTransaction.count(),
      ledgerEntries: await prisma.ledgerEntry.count(),
      events: await prisma.financialEvent.count(),
      outbox: await prisma.financialOutboxEvent.count(),
      refunds: await prisma.refund.count(),
      holds: await prisma.financialHold.findMany({ where: { orderId: s.order.id } }),
      payment: await prisma.payment.findUniqueOrThrow({ where: { orderId: s.order.id } }),
      order: await prisma.order.findUniqueOrThrow({ where: { id: s.order.id } }),
      finance: await finance.summary(s.sellerUser.id),
      snapshots: await prisma.orderFeeComponentSnapshot.findMany({
        where: { orderId: s.order.id },
        orderBy: { id: 'asc' },
      }),
    }).toEqual(before);
  });
});
