import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
import type { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AccessTokenGuard } from '../src/auth/access-token.guard';
import { PlatformRolesGuard } from '../src/auth/platform-roles.guard';
import { CartCsrfGuard } from '../src/carts/cart-csrf.guard';
import { CartsController } from '../src/carts/carts.controller';
import { CartsService } from '../src/carts/carts.service';

class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined>; auth?: { userId: string } }>();
    if (req.headers.authorization !== 'Bearer buyer') throw new UnauthorizedException();
    req.auth = { userId: 'buyer' };
    return true;
  }
}
class TestCsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined> }>();
    if (req.headers['x-csrf-token'] !== 'valid')
      throw new UnauthorizedException({ code: 'INVALID_CSRF' });
    return true;
  }
}

describe('Carts HTTP contract', () => {
  let app: INestApplication;
  const response = {
    id: 'cart',
    status: 'ACTIVE',
    version: 1,
    currency: 'BRL',
    seller: { slug: 'store', storeName: 'Store' },
    items: [],
    previewSubtotalMinor: null,
    checkoutReady: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const carts = {
    list: jest.fn().mockResolvedValue({ page: 1, limit: 20, items: [] }),
    get: jest.fn().mockResolvedValue(response),
    add: jest.fn().mockResolvedValue(response),
    update: jest.fn().mockResolvedValue({ ...response, version: 2 }),
    remove: jest.fn().mockResolvedValue({ ...response, version: 2 }),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [CartsController],
      providers: [{ provide: CartsService, useValue: carts }],
    })
      .overrideGuard(AccessTokenGuard)
      .useClass(TestAuthGuard)
      .overrideGuard(PlatformRolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(CartCsrfGuard)
      .useClass(TestCsrfGuard)
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());
  it('requires authentication', () =>
    request(app.getHttpServer()).get('/api/v1/carts').expect(401));
  it('allows GET without CSRF', () =>
    request(app.getHttpServer())
      .get('/api/v1/carts')
      .set('authorization', 'Bearer buyer')
      .expect(200));
  it.each([
    ['post', '/api/v1/carts/store/items'],
    ['patch', '/api/v1/carts/store/items/10000000-0000-4000-8000-000000000001'],
    ['delete', '/api/v1/carts/store/items/10000000-0000-4000-8000-000000000001'],
  ] as const)('requires CSRF for %s', async (method, path) => {
    const agent = request(app.getHttpServer());
    await agent[method](path)
      .set('authorization', 'Bearer buyer')
      .send({ productId: '10000000-0000-4000-8000-000000000002', quantity: 1, expectedVersion: 0 })
      .expect(401);
  });
  it('accepts valid CSRF and expectedVersion zero', () =>
    request(app.getHttpServer())
      .post('/api/v1/carts/store/items')
      .set('authorization', 'Bearer buyer')
      .set('x-csrf-token', 'valid')
      .send({ productId: '10000000-0000-4000-8000-000000000002', quantity: 1, expectedVersion: 0 })
      .expect(201));
  it.each([
    { quantity: 0, expectedVersion: 0 },
    { quantity: -1, expectedVersion: 0 },
    { quantity: 1000, expectedVersion: 0 },
    { quantity: 1 },
    { quantity: 1, expectedVersion: 0, extra: true },
  ])('rejects invalid add DTO %#', async (payload) => {
    await request(app.getHttpServer())
      .post('/api/v1/carts/store/items')
      .set('authorization', 'Bearer buyer')
      .set('x-csrf-token', 'valid')
      .send({ productId: '10000000-0000-4000-8000-000000000002', ...payload })
      .expect(400);
  });
  it('rejects an invalid item UUID', () =>
    request(app.getHttpServer())
      .patch('/api/v1/carts/store/items/not-a-uuid')
      .set('authorization', 'Bearer buyer')
      .set('x-csrf-token', 'valid')
      .send({ quantity: 2, expectedVersion: 1 })
      .expect(400));
});
