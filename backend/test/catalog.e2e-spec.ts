import { HttpStatus, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AccessTokenGuard } from '../src/auth/access-token.guard';
import { PlatformRolesGuard } from '../src/auth/platform-roles.guard';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/redis/redis.service';

const cat = {
  id: '00000000-0000-4000-8000-000000000001',
  slug: 'contas',
  name: 'Contas',
  description: null,
  iconKey: 'Gift',
  colorHex: '#8B5CF6',
  featured: true,
  sortOrder: 1,
  status: 'ACTIVE',
};
const inactive = {
  ...cat,
  id: '00000000-0000-4000-8000-000000000002',
  slug: 'old',
  status: 'INACTIVE',
};
const sub = {
  id: '00000000-0000-4000-8000-000000000101',
  categoryId: cat.id,
  slug: 'valorant',
  name: 'Valorant',
  sortOrder: 1,
  status: 'ACTIVE',
  createdAt: new Date(),
  updatedAt: new Date(),
};
const attr = {
  id: '00000000-0000-4000-8000-000000001001',
  subcategoryId: null,
  productType: 'VIRTUAL_CURRENCY',
  key: 'quantidade',
  label: 'Quantidade disponível',
  inputType: 'NUMBER',
  placeholder: '0',
  required: false,
  selectOptions: [],
  sortOrder: 1,
  status: 'ACTIVE',
  createdAt: new Date(),
  updatedAt: new Date(),
};

class TestAccessGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const req = ctx
      .switchToHttp()
      .getRequest<{ headers: Record<string, string>; auth?: { userId: string } }>();
    if (!req.headers['x-test-user']) throw new UnauthorizedException({ code: 'UNAUTHORIZED' });
    req.auth = { userId: req.headers['x-test-user'] };
    return true;
  }
}
class TestRoleGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    return (
      ctx.switchToHttp().getRequest<{ headers: Record<string, string> }>().headers[
        'x-test-role'
      ] === 'admin'
    );
  }
}
function prisma() {
  const tx = {
    catalogCategory: {
      findMany: jest.fn(({ where }: { where?: { status?: string } }) =>
        Promise.resolve(where?.status === 'ACTIVE' ? [cat] : [cat, inactive]),
      ),
      findFirst: jest.fn(({ where }: { where: { slug?: string; status?: string } }) =>
        Promise.resolve(where.slug === 'contas' && where.status === 'ACTIVE' ? cat : null),
      ),
      create: jest.fn(({ data }: { data: typeof cat }) => Promise.resolve({ ...cat, ...data })),
      update: jest.fn(({ data }: { data: Partial<typeof cat> }) =>
        Promise.resolve({ ...cat, ...data }),
      ),
      findUniqueOrThrow: jest.fn(() => Promise.resolve(cat)),
    },
    catalogSubcategory: {
      findMany: jest.fn(() => Promise.resolve([sub])),
      findFirst: jest.fn(() => Promise.resolve(sub)),
      findUnique: jest.fn(() => Promise.resolve(sub)),
      create: jest.fn(({ data }: { data: typeof sub }) => Promise.resolve({ ...sub, ...data })),
      update: jest.fn(({ data }: { data: Partial<typeof sub> }) =>
        Promise.resolve({ ...sub, ...data }),
      ),
      findUniqueOrThrow: jest.fn(() => Promise.resolve(sub)),
    },
    catalogAttribute: {
      findMany: jest.fn(() => Promise.resolve([attr])),
      create: jest.fn(({ data }: { data: typeof attr }) => Promise.resolve({ ...attr, ...data })),
      update: jest.fn(({ data }: { data: Partial<typeof attr> }) =>
        Promise.resolve({ ...attr, ...data }),
      ),
      findUniqueOrThrow: jest.fn(() => Promise.resolve(attr)),
    },
    securityEvent: { create: jest.fn(() => Promise.resolve({})) },
    isHealthy: jest.fn(() => Promise.resolve(true)),
  };
  return { ...tx, $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)) };
}

describe('Catalog taxonomy HTTP (e2e)', () => {
  let app: INestApplication;
  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma())
      .overrideProvider(RedisService)
      .useValue({ isHealthy: jest.fn(() => Promise.resolve(true)) })
      .overrideGuard(AccessTokenGuard)
      .useClass(TestAccessGuard)
      .overrideGuard(PlatformRolesGuard)
      .useClass(TestRoleGuard)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });
  afterEach(async () => app.close());

  it('serves public catalog endpoints with active records and lowercase contracts', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/catalog/categories')
      .expect(HttpStatus.OK)
      .expect(({ body }) =>
        expect(body.items).toEqual([expect.not.objectContaining({ status: expect.anything() })]),
      );
    await request(app.getHttpServer())
      .get('/api/v1/catalog/categories/old')
      .expect(HttpStatus.NOT_FOUND);
    await request(app.getHttpServer())
      .get('/api/v1/catalog/categories/contas/subcategories')
      .expect(HttpStatus.OK)
      .expect(({ body }) => expect(body.items[0].slug).toBe('valorant'));
    await request(app.getHttpServer())
      .get('/api/v1/catalog/product-types')
      .expect(HttpStatus.OK)
      .expect(({ body }) =>
        expect(body.items).toContainEqual({ id: 'virtual_currency', name: 'Moeda virtual' }),
      );
    await request(app.getHttpServer())
      .get('/api/v1/catalog/attributes?productType=virtual_currency')
      .expect(HttpStatus.OK)
      .expect(({ body }) => expect(body.items[0]).toMatchObject({ inputType: 'number' }));
  });

  it('protects and validates admin endpoints', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/catalog/categories')
      .expect(HttpStatus.UNAUTHORIZED);
    await request(app.getHttpServer())
      .get('/api/v1/admin/catalog/categories')
      .set('x-test-user', 'buyer')
      .set('x-test-role', 'buyer')
      .expect(HttpStatus.FORBIDDEN);
    await request(app.getHttpServer())
      .get('/api/v1/admin/catalog/attributes')
      .set('x-test-user', 'admin')
      .set('x-test-role', 'admin')
      .expect(HttpStatus.OK)
      .expect(({ body }) =>
        expect(body.items[0]).toMatchObject({
          productType: 'virtual_currency',
          inputType: 'number',
        }),
      );
    await request(app.getHttpServer())
      .patch('/api/v1/admin/catalog/categories/00000000-0000-4000-8000-000000000001')
      .set('x-test-user', 'admin')
      .set('x-test-role', 'admin')
      .send({ extra: true })
      .expect(HttpStatus.BAD_REQUEST);
    await request(app.getHttpServer())
      .patch('/api/v1/admin/catalog/categories/00000000-0000-4000-8000-000000000001')
      .set('x-test-user', 'admin')
      .set('x-test-role', 'admin')
      .send({})
      .expect(HttpStatus.BAD_REQUEST);
    await request(app.getHttpServer())
      .post('/api/v1/admin/catalog/attributes')
      .set('x-test-user', 'admin')
      .set('x-test-role', 'admin')
      .send({ key: 'elo', label: 'Elo', inputType: 'select' })
      .expect(HttpStatus.BAD_REQUEST);
  });
});
