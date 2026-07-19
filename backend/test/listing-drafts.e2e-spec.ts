import {
  ForbiddenException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
  ValidationPipe,
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
  return {
    list: jest.fn((userId: string) => ({
      items: userId === 'seller-b' ? [{ ...sellerSummary, id: otherDraftId }] : [sellerSummary],
      nextCursor: null,
    })),
    create: jest.fn(() => sellerDetail),
    get: jest.fn((_userId: string, id: string) => {
      if (id === otherDraftId) throw new NotFoundException({ code: 'LISTING_DRAFT_NOT_FOUND' });
      return sellerDetail;
    }),
    update: jest.fn((_userId: string, id: string) => {
      if (id === otherDraftId) throw new NotFoundException({ code: 'LISTING_DRAFT_NOT_FOUND' });
      return { ...sellerDetail, title: 'Atualizado', version: 2 };
    }),
    submit: jest.fn((_userId: string, id: string) => {
      if (id === otherDraftId) throw new NotFoundException({ code: 'LISTING_DRAFT_NOT_FOUND' });
      return { ...sellerDetail, status: 'PENDING_REVIEW', version: 3 };
    }),
    adminList: jest.fn(() => ({ items: [adminSummary], nextCursor: null })),
    adminGet: jest.fn(() => adminDetail),
    startReview: jest.fn(() => ({
      ...adminDetail,
      status: 'UNDER_REVIEW',
      reviewer: { id: 'admin' },
      version: 4,
    })),
    reject: jest.fn(() => ({
      ...adminDetail,
      status: 'REJECTED',
      reviewer: { id: 'admin' },
      version: 5,
    })),
    approve: jest.fn(() => ({
      ...adminDetail,
      status: 'APPROVED',
      reviewer: { id: 'admin' },
      version: 7,
    })),
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
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('enforces seller and admin guards', async () => {
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
      .post(`/api/v1/admin/listing-drafts/${draftId}/approve`)
      .set('x-test-user', 'admin')
      .set('x-test-roles', 'ADMIN')
      .send({ expectedVersion: 6 })
      .expect(HttpStatus.CREATED)
      .expect(({ body }) => expect(body).toMatchObject({ status: 'APPROVED' }));
  });
});
