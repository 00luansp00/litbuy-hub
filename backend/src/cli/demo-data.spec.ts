import { DEMO_IMAGES, DEMO_PRODUCTS, DEMO_USERS } from './demo-data.fixtures';
import { runDemoCommand } from './demo-data';
import { assertDemoEnvironment, DemoDataError, parseDemoCommand } from './demo-data.guard';

const env = {
  NODE_ENV: 'test',
  DEMO_DATA_ENABLED: 'true',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/litbuy_test',
  DEMO_USER_PASSWORD: 'public-demo-password',
  PRODUCT_IMAGE_S3_ENDPOINT: 'http://localhost:9000',
  PRODUCT_IMAGE_S3_BUCKET: 'test',
  PRODUCT_IMAGE_S3_ACCESS_KEY: 'test',
  PRODUCT_IMAGE_S3_SECRET_KEY: 'test',
  CURRENT_TERMS_VERSION: 'test',
  CURRENT_PRIVACY_VERSION: 'test',
  CURRENT_SELLER_AGREEMENT_VERSION: 'test',
} as NodeJS.ProcessEnv;
const code = (action: () => void) => {
  try {
    action();
  } catch (error) {
    return (error as DemoDataError).code;
  }
  return null;
};

describe('local demo data guards and deterministic fixtures', () => {
  it('refuses production, disabled, suspicious databases and storage', () => {
    expect(code(() => assertDemoEnvironment({ ...env, NODE_ENV: 'production' }))).toBe(
      'DEMO_DATA_PRODUCTION_REFUSED',
    );
    expect(code(() => assertDemoEnvironment({ ...env, DEMO_DATA_ENABLED: undefined }))).toBe(
      'DEMO_DATA_DISABLED',
    );
    expect(
      code(() =>
        assertDemoEnvironment({ ...env, DATABASE_URL: 'postgresql://u:p@example.com/litbuy_prod' }),
      ),
    ).toBe('DEMO_DATA_DATABASE_REFUSED');
    expect(
      code(() =>
        assertDemoEnvironment({ ...env, PRODUCT_IMAGE_S3_ENDPOINT: 'https://s3.example.com' }),
      ),
    ).toBe('DEMO_DATA_STORAGE_REFUSED');
  });
  it('parses commands and requires reset confirmation', () => {
    expect(parseDemoCommand(['seed'])).toBe('seed');
    expect(parseDemoCommand(['verify'])).toBe('verify');
    expect(parseDemoCommand(['reset', '--confirm'])).toBe('reset');
    expect(code(() => parseDemoCommand(['reset']))).toBe('DEMO_DATA_CONFIRMATION_REQUIRED');
  });
  it('cannot invoke any public operation without the guard', async () => {
    await expect(
      runDemoCommand(['seed'], { ...env, DEMO_DATA_ENABLED: undefined }),
    ).rejects.toMatchObject({ code: 'DEMO_DATA_DISABLED' });
    await expect(
      runDemoCommand(['reset', '--confirm'], { ...env, NODE_ENV: 'production' }),
    ).rejects.toMatchObject({ code: 'DEMO_DATA_PRODUCTION_REFUSED' });
    await expect(runDemoCommand(['reset'], env)).rejects.toMatchObject({
      code: 'DEMO_DATA_CONFIRMATION_REQUIRED',
    });
  });
  it('keeps IDs, slugs, keys and fixtures deterministic and namespaced', () => {
    expect(new Set(DEMO_PRODUCTS.map((x) => x.id)).size).toBe(8);
    expect(
      DEMO_PRODUCTS.every((x) => x.slug.startsWith('demo-') && x.objectKey.startsWith('demo/')),
    ).toBe(true);
    expect(DEMO_USERS.every((x) => x.email.endsWith('@demo.litbuy.local'))).toBe(true);
    expect(new Set(DEMO_IMAGES.map((image) => image.sha256)).size).toBe(8);
    expect(
      DEMO_IMAGES.every(
        (image) => image.body.length > 0 && image.body.subarray(1, 4).toString() === 'PNG',
      ),
    ).toBe(true);
    expect(DEMO_PRODUCTS.map((product) => product.createdAt.toISOString())).toEqual(
      [...DEMO_PRODUCTS].map((product) => product.createdAt.toISOString()).sort(),
    );
    expect(JSON.stringify({ products: DEMO_PRODUCTS, users: DEMO_USERS })).not.toMatch(
      /cpf|pix|token|secret|passwordHash/i,
    );
  });
  it('keeps public summaries and errors free from runtime secrets', () => {
    const output = JSON.stringify({
      ok: false,
      code: new DemoDataError('DEMO_DATA_DISABLED').code,
    });
    expect(output).not.toContain(env.DEMO_USER_PASSWORD);
    expect(output).not.toContain(env.DATABASE_URL);
    expect(output).not.toContain(env.PRODUCT_IMAGE_S3_ACCESS_KEY);
    expect(output).not.toContain(env.PRODUCT_IMAGE_S3_SECRET_KEY);
  });
});
