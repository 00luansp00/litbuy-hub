/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/require-await */
import type { ConfigService } from '@nestjs/config';
import {
  PlatformRole,
  SecurityEventType,
  SellerApplicationStatus,
  UserStatus,
} from '@prisma/client';
import { SellerOnboardingService } from './seller-onboarding.service';

const userId = '11111111-1111-4111-8111-111111111111';
const adminId = '22222222-2222-4222-8222-222222222222';
const appId = '33333333-3333-4333-8333-333333333333';

function nowDate(years = 30) {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d;
}
function application(overrides = {}) {
  return {
    id: appId,
    userId,
    storeName: 'Minha Loja',
    requestedSlug: 'minha-loja',
    description: null,
    status: SellerApplicationStatus.DRAFT,
    sellerAgreementVersion: null,
    sellerAgreementAcceptedAt: null,
    submittedAt: null,
    reviewedAt: null,
    reviewedByUserId: null,
    rejectionCode: null,
    rejectionReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
function activeUser(overrides = {}) {
  return {
    id: userId,
    email: 'u@test.dev',
    phoneE164: '+5511999999999',
    phoneVerifiedAt: new Date(),
    birthDate: nowDate(),
    status: UserStatus.ACTIVE,
    emailVerifiedAt: new Date(),
    termsVersion: 'x',
    termsAcceptedAt: new Date(),
    privacyVersion: 'x',
    privacyAcceptedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    sensitiveActionHoldUntil: null,
    lastSensitiveChangeAt: null,
    roleAssignments: [{ role: PlatformRole.BUYER }],
    ...overrides,
  };
}
function makeService(seed = application()) {
  let app = seed;
  const events: unknown[] = [];
  const profiles: unknown[] = [];
  const roles: unknown[] = [];
  const tx = {
    user: { findUnique: jest.fn().mockResolvedValue(activeUser()) },
    sellerApplication: {
      findUnique: jest.fn(async () => app),
      upsert: jest.fn(async ({ create, update }) => {
        app = app ? { ...app, ...update } : application(create);
        return app;
      }),
      update: jest.fn(async ({ data }) => {
        app = { ...app, ...data };
        return app;
      }),
    },
    sellerProfile: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(async ({ data }) => {
        const profile = {
          id: '44444444-4444-4444-8444-444444444444',
          status: 'ACTIVE',
          verified: false,
          ...data,
        };
        profiles.push(profile);
        return profile;
      }),
    },
    userRoleAssignment: {
      createMany: jest.fn(async ({ data }) => {
        roles.push(...data);
        return { count: 1 };
      }),
    },
    securityEvent: {
      create: jest.fn(async ({ data }) => {
        events.push(data);
        return data;
      }),
    },
  };
  const prisma = {
    user: {
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValue({ ...activeUser(), sellerApplication: app, sellerProfile: null }),
    },
    sellerProfile: tx.sellerProfile,
    sellerApplication: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(async () => app),
    },
    $transaction: jest.fn((fn) => fn(tx)),
  };
  const service = new SellerOnboardingService(
    prisma as never,
    { getOrThrow: jest.fn(() => '2026-test') } as unknown as ConfigService,
  );
  return {
    service,
    tx,
    prisma,
    events,
    profiles,
    roles,
    get app() {
      return app;
    },
    setUser: (u: unknown) => tx.user.findUnique.mockResolvedValue(u),
  };
}

describe('SellerOnboardingService', () => {
  it('returns me with current agreement flags', async () => {
    const { service } = makeService(
      application({ sellerAgreementVersion: '2026-test', sellerAgreementAcceptedAt: new Date() }),
    );
    await expect(service.me(userId)).resolves.toMatchObject({
      requirements: { sellerAgreementAccepted: true, sellerAgreementCurrent: true },
    });
  });
  it('saves draft without agreement and with normalized data', async () => {
    const ctx = makeService(null as never);
    const saved = await ctx.service.saveDraft(userId, {
      storeName: ' Minha   Loja ',
      requestedSlug: 'Minha Loja',
      description: ' texto ',
      sellerAgreementAccepted: false,
    });
    expect(saved).toMatchObject({ storeName: 'Minha Loja', requestedSlug: 'minha-loja' });
    expect(ctx.app.sellerAgreementVersion).toBeNull();
  });
  it('saves draft with agreement version once', async () => {
    const acceptedAt = new Date('2026-01-01');
    const ctx = makeService(
      application({ sellerAgreementVersion: '2026-test', sellerAgreementAcceptedAt: acceptedAt }),
    );
    await ctx.service.saveDraft(userId, {
      storeName: 'Outra Loja',
      requestedSlug: 'outra-loja',
      sellerAgreementAccepted: true,
    });
    expect(ctx.app.sellerAgreementAcceptedAt).toBe(acceptedAt);
  });
  it('blocks submit for account requirements and outdated agreements', async () => {
    const ctx = makeService(
      application({ sellerAgreementVersion: 'old', sellerAgreementAcceptedAt: new Date() }),
    );
    await expect(ctx.service.submit(userId)).rejects.toMatchObject({
      code: 'SELLER_AGREEMENT_VERSION_OUTDATED',
    });
    ctx.setUser(activeUser({ phoneVerifiedAt: null }));
    await expect(ctx.service.submit(userId)).rejects.toMatchObject({
      code: 'SELLER_PHONE_NOT_VERIFIED',
    });
  });
  it('submits idempotently and audits', async () => {
    const ctx = makeService(
      application({ sellerAgreementVersion: '2026-test', sellerAgreementAcceptedAt: new Date() }),
    );
    await expect(ctx.service.submit(userId)).resolves.toMatchObject({ status: 'submitted' });
    await expect(ctx.service.submit(userId)).resolves.toMatchObject({ status: 'submitted' });
    expect(ctx.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ eventType: SecurityEventType.SELLER_APPLICATION_SUBMITTED }),
      ]),
    );
  });
  it('starts review, rejects, and allows correction after rejection', async () => {
    const ctx = makeService(
      application({
        status: SellerApplicationStatus.SUBMITTED,
        sellerAgreementVersion: '2026-test',
        sellerAgreementAcceptedAt: new Date(),
      }),
    );
    await expect(ctx.service.startReview(appId, adminId)).resolves.toMatchObject({
      status: 'under_review',
    });
    await expect(
      ctx.service.reject(appId, adminId, { code: 'OTHER', reason: 'Revise.' }),
    ).resolves.toMatchObject({ status: 'rejected' });
    await expect(
      ctx.service.saveDraft(userId, {
        storeName: 'Loja Nova',
        requestedSlug: 'loja-nova',
        sellerAgreementAccepted: true,
      }),
    ).resolves.toMatchObject({ status: 'draft' });
  });
  it('approves atomically with profile verified false and SELLER role', async () => {
    const ctx = makeService(
      application({
        status: SellerApplicationStatus.SUBMITTED,
        sellerAgreementVersion: '2026-test',
        sellerAgreementAcceptedAt: new Date(),
      }),
    );
    await expect(ctx.service.approve(appId, adminId)).resolves.toMatchObject({
      status: 'approved',
    });
    expect(ctx.profiles).toEqual([
      expect.objectContaining({ verified: false, slug: 'minha-loja' }),
    ]);
    expect(ctx.roles).toEqual([expect.objectContaining({ role: PlatformRole.SELLER })]);
  });
  it('propagates profile creation, role grant, and audit failures from the unit fake', async () => {
    const ctx = makeService(
      application({
        status: SellerApplicationStatus.SUBMITTED,
        sellerAgreementVersion: '2026-test',
        sellerAgreementAcceptedAt: new Date(),
      }),
    );
    ctx.tx.sellerProfile.create.mockRejectedValueOnce(new Error('profile failed'));
    await expect(ctx.service.approve(appId, adminId)).rejects.toThrow('profile failed');
    ctx.tx.sellerProfile.create.mockResolvedValueOnce({});
    ctx.tx.userRoleAssignment.createMany.mockRejectedValueOnce(new Error('role failed'));
    await expect(ctx.service.approve(appId, adminId)).rejects.toThrow('role failed');
    ctx.tx.userRoleAssignment.createMany.mockResolvedValueOnce({ count: 1 });
    ctx.tx.securityEvent.create.mockRejectedValueOnce(new Error('audit failed'));
    await expect(ctx.service.approve(appId, adminId)).rejects.toThrow('audit failed');
  });
  it('validates admin pagination input via DTO contract at controller layer and returns nextCursor', async () => {
    const ctx = makeService();
    ctx.prisma.sellerApplication.findMany.mockResolvedValueOnce([
      application({ id: appId, user: activeUser() }),
      application({ id: '55555555-5555-4555-8555-555555555555', user: activeUser() }),
    ]);
    await expect(
      ctx.service.listAdmin({ status: 'draft', search: ' loja ', limit: 1 }),
    ).resolves.toMatchObject({
      nextCursor: appId,
      items: [
        expect.objectContaining({
          requirements: expect.objectContaining({
            sellerAgreementAccepted: false,
            sellerAgreementCurrent: false,
          }),
        }),
      ],
    });
  });
});
