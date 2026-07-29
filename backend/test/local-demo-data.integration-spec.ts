import { DEMO_PRODUCTS, DEMO_SUMMARY } from '../src/cli/demo-data.fixtures';
import { reset, seed, verify } from '../src/cli/demo-data';

const describeReal =
  process.env.RUN_LOCAL_DEMO_DATA_INTEGRATION === 'true' ? describe : describe.skip;

describeReal('local demo data with real PostgreSQL and MinIO', () => {
  jest.setTimeout(120_000);
  afterAll(async () => void (await reset()));
  it('seeds twice, verifies deterministic objects and resets twice', async () => {
    expect(await seed()).toMatchObject(DEMO_SUMMARY);
    expect(await verify()).toMatchObject(DEMO_SUMMARY);
    expect(await seed()).toMatchObject(DEMO_SUMMARY);
    expect(new Set(DEMO_PRODUCTS.map((item) => item.objectKey)).size).toBe(DEMO_SUMMARY.images);
    expect(await reset()).toMatchObject({ ok: true, action: 'reset' });
    expect(await reset()).toMatchObject({ ok: true, action: 'reset' });
  });
});
