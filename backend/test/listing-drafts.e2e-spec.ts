import {
  ConflictException,
  ForbiddenException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AccessTokenGuard } from '../src/auth/access-token.guard';
import { PlatformRolesGuard } from '../src/auth/platform-roles.guard';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { ListingDraftsService } from '../src/listing-drafts/listing-drafts.service';

const draftId = '00000000-0000-4000-8000-000000000123';
const otherDraftId = '00000000-0000-4000-8000-000000000999';

const sellerSummary = {
  id: draftId,
  status: 'DRAFT',
  model: 'NORMAL',
  title: 'Rascunho seguro',
  category: null,
  subcategory: null,
  productType: null,
  price: null,
  stock: null,
  wizardStep: 1,
  version: 1,
  submittedAt: null,
  updatedAt: '2026-07-19T12:00:00.000Z',
  rejectionCode: null,
  rejectionReason: null,
};

const sellerDetail = {
  ...sellerSummary,
  description: null,
  deliveryMode: 'MANUAL',
  requestedPromotionTier: 'SILVER',
  requestedSellerPlan: 'STANDARD',
  autoMessage: null,
  notifications: {
    inApp: true,
    browser: false,
    emailFuture: false,
    externalIntegrationFuture: false,
  },
  createdAt: '2026-07-19T12:00:00.000Z',
  variants: [],
  attributes: [],
  serviceDetails: null,
  accountDetails: null,
};

const adminSummary = {
  ...sellerSummary,
  seller: {
    id: '00000000-0000-4000-8000-000000000222',
    storeName: 'Loja segura',
    slug: 'loja-segura',
    status: 'ACTIVE',
    verified: false,
  },
  reviewer: null,
  reviewStartedAt: null,
  reviewedAt: null,
  approvedAt: null,
};

const adminDetail = { ...sellerDetail, seller: adminSummary.seller, reviewer: null };

class TestAccessGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const requestContext = ctx.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      auth?: { userId: string; sessionId: string; deviceId: string };
    }>();
    const userId = requestContext.headers['x-test-user'];
    if (!userId) throw new UnauthorizedException({ code: 'UNAUTHORIZED' });
    requestContext.auth = { userId, sessionId: 'test-session', deviceId: 'test-device' };
    return true;
  }
}

class TestRolesGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const requestContext = ctx.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      originalUrl: string;
    }>();
    const roles = new Set((requestContext.headers['x-test-roles'] ?? '').split(','));
    const requiresAdmin = requestContext.originalUrl.includes('/admin/');
    const requiresSeller = requestContext.originalUrl.includes('/seller/');
    if (requiresAdmin && !roles.has('ADMIN')) throw new ForbiddenException({ code: 'FORBIDDEN' });
    if (requiresSeller && !roles.has('SELLER')) throw new ForbiddenException({ code: 'FORBIDDEN' });
    return true;
  }
}

function serviceMock() {
  type DraftMock = Omit<
    typeof sellerDetail,
    'status' | 'title' | 'version' | 'rejectionCode' | 'rejectionReason'
  > & {
    status: string;
    title: string;
    version: number;
    rejectionCode: string | null;
    rejectionReason: string | null;
  };
  type AdminDraftMock = Omit<
    typeof adminDetail,
    'status' | 'title' | 'version' | 'reviewer' | 'rejectionCode' | 'rejectionReason'
  > & {
    status: string;
    title: string;
    version: number;
    reviewer: { id: string } | null;
    reviewStartedAt: string | null;
    reviewedAt: string | null;
    approvedAt: string | null;
    rejectionCode: string | null;
    rejectionReason: string | null;
  };
  let draft: DraftMock = { ...sellerDetail };
  let adminDraft: AdminDraftMock = {
    ...adminDetail,
    reviewStartedAt: null,
    reviewedAt: null,
    approvedAt: null,
  };
  const conflict = () => new ConflictException({ code: 'LISTING_DRAFT_VERSION_CONFLICT' });
  const ensureVersion = (expectedVersion?: number) => {
    if (expectedVersion !== draft.version) throw conflict();
  };
  const sellerSummaryFromDraft = () => ({
    id: draft.id,
    status: draft.status,
    model: draft.model,
    title: draft.title,
    category: draft.category,
    subcategory: draft.subcategory,
    productType: draft.productType,
    price: draft.price,
    stock: draft.stock,
    wizardStep: draft.wizardStep,
    version: draft.version,
    submittedAt: draft.submittedAt,
    updatedAt: draft.updatedAt,
    rejectionCode: draft.rejectionCode,
    rejectionReason: draft.rejectionReason,
  });
  const adminSummaryFromDraft = () => ({
    ...sellerSummaryFromDraft(),
    seller: adminSummary.seller,
    reviewer: adminDraft.reviewer,
    reviewStartedAt: adminDraft.reviewStartedAt,
    reviewedAt: adminDraft.reviewedAt,
    approvedAt: adminDraft.approvedAt,
  });
  const syncAdmin = (patch: Partial<AdminDraftMock> = {}) => {
    adminDraft = {
      ...adminDraft,
      ...draft,
      seller: adminSummary.seller,
      reviewer: 'reviewer' in patch ? patch.reviewer! : adminDraft.reviewer,
      ...patch,
    };
    return adminDraft;
  };
  return {
    list: jest.fn((userId: string) => ({
      items:
        userId === 'seller-b'
          ? [{ ...sellerSummary, id: otherDraftId }]
          : [sellerSummaryFromDraft()],
      nextCursor: null,
    })),
    create: jest.fn(() => {
      draft = { ...sellerDetail };
      syncAdmin({ reviewer: null });
      return draft;
    }),
    get: jest.fn((_userId: string, id: string) => {
      if (id === otherDraftId) throw new NotFoundException({ code: 'LISTING_DRAFT_NOT_FOUND' });
      return draft;
    }),
    update: jest.fn(
      (_userId: string, id: string, dto: { expectedVersion?: number; title?: string }) => {
        if (id === otherDraftId) throw new NotFoundException({ code: 'LISTING_DRAFT_NOT_FOUND' });
        ensureVersion(dto.expectedVersion);
        if (!['DRAFT', 'REJECTED'].includes(draft.status)) {
          throw new ConflictException({ code: 'LISTING_DRAFT_STATUS_CONFLICT' });
        }
        draft = { ...draft, title: dto.title ?? 'Atualizado', version: draft.version + 1 };
        syncAdmin();
        return draft;
      },
    ),
    submit: jest.fn((_userId: string, id: string, dto: { expectedVersion?: number }) => {
      if (id === otherDraftId) throw new NotFoundException({ code: 'LISTING_DRAFT_NOT_FOUND' });
      if (draft.status === 'PENDING_REVIEW') return draft;
      ensureVersion(dto.expectedVersion);
      if (!['DRAFT', 'REJECTED'].includes(draft.status)) {
        throw new ConflictException({ code: 'LISTING_DRAFT_STATUS_CONFLICT' });
      }
      draft = {
        ...draft,
        status: 'PENDING_REVIEW',
        version: draft.version + 1,
        rejectionCode: null,
        rejectionReason: null,
      };
      syncAdmin({ reviewer: null, reviewStartedAt: null, reviewedAt: null, approvedAt: null });
      return draft;
    }),
    adminList: jest.fn(() => ({ items: [adminSummaryFromDraft()], nextCursor: null })),
    adminGet: jest.fn(() => adminDraft),
    startReview: jest.fn((_adminId: string, _id: string, dto: { expectedVersion?: number }) => {
      if (draft.status === 'UNDER_REVIEW') return adminDraft;
      ensureVersion(dto.expectedVersion);
      if (draft.status !== 'PENDING_REVIEW') {
        throw new ConflictException({ code: 'LISTING_DRAFT_STATUS_CONFLICT' });
      }
      draft = { ...draft, status: 'UNDER_REVIEW', version: draft.version + 1 };
      return syncAdmin({ reviewer: { id: 'admin' }, reviewStartedAt: '2026-07-19T12:01:00.000Z' });
    }),
    reject: jest.fn(
      (
        _adminId: string,
        _id: string,
        dto: { expectedVersion?: number; rejectionCode?: string; rejectionReason?: string },
      ) => {
        ensureVersion(dto.expectedVersion);
        if (!['PENDING_REVIEW', 'UNDER_REVIEW'].includes(draft.status)) {
          throw new ConflictException({ code: 'LISTING_DRAFT_STATUS_CONFLICT' });
        }
        draft = {
          ...draft,
          status: 'REJECTED',
          version: draft.version + 1,
          rejectionCode: dto.rejectionCode ?? 'OTHER',
          rejectionReason: dto.rejectionReason ?? 'Corrija a descrição',
        };
        return syncAdmin({
          reviewer: { id: 'admin' },
          reviewedAt: '2026-07-19T12:02:00.000Z',
          rejectionCode: draft.rejectionCode,
          rejectionReason: draft.rejectionReason,
        });
      },
    ),
    approve: jest.fn((_adminId: string, _id: string, dto: { expectedVersion?: number }) => {
      ensureVersion(dto.expectedVersion);
      if (!['PENDING_REVIEW', 'UNDER_REVIEW'].includes(draft.status)) {
        throw new ConflictException({ code: 'LISTING_DRAFT_STATUS_CONFLICT' });
      }
      draft = { ...draft, status: 'APPROVED', version: draft.version + 1 };
      return syncAdmin({
        reviewer: { id: 'admin' },
        reviewedAt: '2026-07-19T12:03:00.000Z',
        approvedAt: '2026-07-19T12:03:00.000Z',
      });
    }),
  };
}

describe('Listing drafts (e2e)', () => {
  let app: INestApplication;
  let service: ReturnType<typeof serviceMock>;

  beforeEach(async () => {
    service = serviceMock();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ isHealthy: jest.fn().mockResolvedValue(true) })
      .overrideProvider(RedisService)
      .useValue({ isHealthy: jest.fn().mockResolvedValue(true) })
      .overrideProvider(ListingDraftsService)
      .useValue(service)
      .overrideGuard(AccessTokenGuard)
      .useClass(TestAccessGuard)
      .overrideGuard(PlatformRolesGuard)
      .useClass(TestRolesGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('enforces seller and admin guards without duplicate versioned routes', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/v1/seller/listing-drafts')
      .set('x-test-user', 'seller')
      .set('x-test-roles', 'SELLER')
      .expect(HttpStatus.NOT_FOUND);
    await request(app.getHttpServer())
      .get('/api/v1/v1/admin/listing-drafts')
      .set('x-test-user', 'admin')
      .set('x-test-roles', 'ADMIN')
      .expect(HttpStatus.NOT_FOUND);
    await request(app.getHttpServer())
      .get('/api/v1/seller/listing-drafts')
      .expect(HttpStatus.UNAUTHORIZED);
    await request(app.getHttpServer())
      .get('/api/v1/seller/listing-drafts')
      .set('x-test-user', 'buyer')
      .set('x-test-roles', 'BUYER')
      .expect(HttpStatus.FORBIDDEN);
    await request(app.getHttpServer())
      .get('/api/v1/seller/listing-drafts')
      .set('x-test-user', 'seller')
      .set('x-test-roles', 'SELLER')
      .expect(HttpStatus.OK);
    await request(app.getHttpServer())
      .get('/api/v1/admin/listing-drafts')
      .set('x-test-user', 'seller')
      .set('x-test-roles', 'SELLER')
      .expect(HttpStatus.FORBIDDEN);
    await request(app.getHttpServer())
      .get('/api/v1/admin/listing-drafts')
      .set('x-test-user', 'admin')
      .set('x-test-roles', 'ADMIN')
      .expect(HttpStatus.OK);
  });

  it('returns seller summary and detail contracts without e-mail or reviewer', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/v1/seller/listing-drafts')
      .set('x-test-user', 'seller')
      .set('x-test-roles', 'SELLER')
      .expect(HttpStatus.OK);
    expect(list.body.items[0]).not.toHaveProperty('description');
    expect(JSON.stringify(list.body)).not.toContain('userEmail');
    expect(JSON.stringify(list.body)).not.toContain('@');
    expect(JSON.stringify(list.body)).not.toContain('reviewer');

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/seller/listing-drafts/${draftId}`)
      .set('x-test-user', 'seller')
      .set('x-test-roles', 'SELLER')
      .expect(HttpStatus.OK);
    expect(detail.body).toHaveProperty('description');
    expect(JSON.stringify(detail.body)).not.toContain('userEmail');
    expect(JSON.stringify(detail.body)).not.toContain('@');
    expect(JSON.stringify(detail.body)).not.toContain('reviewer');
  });

  it('returns admin summary and detail contracts without personal e-mail', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/v1/admin/listing-drafts')
      .set('x-test-user', 'admin')
      .set('x-test-roles', 'ADMIN')
      .expect(HttpStatus.OK);
    expect(list.body.items[0]).toHaveProperty('seller.storeName', 'Loja segura');
    expect(list.body.items[0]).not.toHaveProperty('description');
    expect(JSON.stringify(list.body)).not.toContain('userEmail');
    expect(JSON.stringify(list.body)).not.toContain('@');

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/admin/listing-drafts/${draftId}`)
      .set('x-test-user', 'admin')
      .set('x-test-roles', 'ADMIN')
      .expect(HttpStatus.OK);
    expect(detail.body).toHaveProperty('description');
    expect(JSON.stringify(detail.body)).not.toContain('userEmail');
    expect(JSON.stringify(detail.body)).not.toContain('@');
  });

  it('rejects seller mass assignment fields', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/seller/listing-drafts')
      .set('x-test-user', 'seller')
      .set('x-test-roles', 'SELLER')
      .send({
        title: 'Seguro',
        sellerProfileId: draftId,
        userId: draftId,
        status: 'APPROVED',
        version: 9,
        reviewedByUserId: draftId,
        approvedAt: '2026-07-19T12:00:00.000Z',
        secureVaultLines: [],
        images: [],
        coverImageId: 'local',
        galleryImageIds: [],
      })
      .expect(HttpStatus.BAD_REQUEST);
  });

  it('does not reveal ownership for another seller draft', async () => {
    for (const call of [
      () => request(app.getHttpServer()).get(`/api/v1/seller/listing-drafts/${otherDraftId}`),
      () =>
        request(app.getHttpServer())
          .patch(`/api/v1/seller/listing-drafts/${otherDraftId}`)
          .send({ expectedVersion: 1, title: 'x' }),
      () =>
        request(app.getHttpServer())
          .post(`/api/v1/seller/listing-drafts/${otherDraftId}/submit`)
          .send({ expectedVersion: 1 }),
    ]) {
      const response = await call().set('x-test-user', 'seller-a').set('x-test-roles', 'SELLER');
      expect(JSON.stringify(response.body)).toContain('LISTING_DRAFT_NOT_FOUND');
    }
  });

  it('executes the moderation flow to APPROVED without public product creation', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/seller/listing-drafts')
      .set('x-test-user', 'seller')
      .set('x-test-roles', 'SELLER')
      .send({ title: 'Rascunho' })
      .expect(HttpStatus.CREATED);
    await request(app.getHttpServer())
      .patch(`/api/v1/seller/listing-drafts/${draftId}`)
      .set('x-test-user', 'seller')
      .set('x-test-roles', 'SELLER')
      .send({ expectedVersion: 1, title: 'Atualizado' })
      .expect(HttpStatus.OK);
    await request(app.getHttpServer())
      .post(`/api/v1/seller/listing-drafts/${draftId}/submit`)
      .set('x-test-user', 'seller')
      .set('x-test-roles', 'SELLER')
      .send({ expectedVersion: 2 })
      .expect(HttpStatus.CREATED);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/listing-drafts/${draftId}/start-review`)
      .set('x-test-user', 'admin')
      .set('x-test-roles', 'ADMIN')
      .send({ expectedVersion: 3 })
      .expect(HttpStatus.CREATED);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/listing-drafts/${draftId}/reject`)
      .set('x-test-user', 'admin')
      .set('x-test-roles', 'ADMIN')
      .send({ expectedVersion: 4, rejectionCode: 'OTHER', rejectionReason: 'Corrija a descrição' })
      .expect(HttpStatus.CREATED);
    await request(app.getHttpServer())
      .patch(`/api/v1/seller/listing-drafts/${draftId}`)
      .set('x-test-user', 'seller')
      .set('x-test-roles', 'SELLER')
      .send({ expectedVersion: 5, title: 'Corrigido' })
      .expect(HttpStatus.OK)
      .expect(({ body }) => expect(body).toMatchObject({ status: 'REJECTED', version: 6 }));
    await request(app.getHttpServer())
      .post(`/api/v1/seller/listing-drafts/${draftId}/submit`)
      .set('x-test-user', 'seller')
      .set('x-test-roles', 'SELLER')
      .send({ expectedVersion: 6 })
      .expect(HttpStatus.CREATED)
      .expect(({ body }) => expect(body).toMatchObject({ status: 'PENDING_REVIEW', version: 7 }));
    await request(app.getHttpServer())
      .post(`/api/v1/admin/listing-drafts/${draftId}/approve`)
      .set('x-test-user', 'admin')
      .set('x-test-roles', 'ADMIN')
      .send({ expectedVersion: 7 })
      .expect(HttpStatus.CREATED)
      .expect(({ body }) => expect(body).toMatchObject({ status: 'APPROVED', version: 8 }));
  });
});
