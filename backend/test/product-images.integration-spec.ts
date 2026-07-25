import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { S3ProductImageStorage } from '../src/product-images/s3-product-image.storage';

describe('Product image PostgreSQL + MinIO integration', () => {
  const prisma = new PrismaClient();
  const storage = new S3ProductImageStorage(new ConfigService(process.env));
  beforeAll(() => prisma.$connect());
  afterAll(() => prisma.$disconnect());

  it('performs conditional PUT, HEAD, signed GET and DELETE against real MinIO', async () => {
    const key = `integration/${randomUUID()}.png`;
    const signed = await storage.createUploadUrl({ key, contentType: 'image/png' });
    const headers = { 'Content-Type': 'image/png', 'If-None-Match': '*' };
    const first = await fetch(signed.uploadUrl, {
      method: 'PUT',
      headers,
      body: Buffer.from('real-image'),
    });
    expect(first.ok).toBe(true);
    const second = await fetch(signed.uploadUrl, {
      method: 'PUT',
      headers,
      body: Buffer.from('overwrite'),
    });
    expect(second.status).toBe(412);
    await expect(storage.headObject(key)).resolves.toEqual({
      sizeBytes: 10,
      contentType: 'image/png',
    });
    const read = await storage.createReadUrl(key);
    const downloaded = await fetch(read.readUrl);
    expect(downloaded.ok).toBe(true);
    expect(await downloaded.text()).toBe('real-image');
    await storage.deleteObject(key);
    await expect(storage.headObject(key)).resolves.toBeNull();
  });

  it('exposes the restricted local bucket CORS policy', async () => {
    const response = await fetch(
      `${process.env.PRODUCT_IMAGE_S3_ENDPOINT}/${process.env.PRODUCT_IMAGE_S3_BUCKET}/cors-check`,
      {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'PUT',
          'Access-Control-Request-Headers': 'content-type,if-none-match',
        },
      },
    );
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
    expect(response.headers.get('access-control-allow-methods')).toContain('PUT');
  });

  it('serializes the same advisory key while a different key remains available and releases on commit', async () => {
    const first = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`WITH advisory_lock AS MATERIALIZED (SELECT pg_advisory_xact_lock(hashtext(${'image-lock'}))) SELECT 1::integer AS "acquired" FROM advisory_lock`;
      const same = await prisma.$queryRaw<
        { acquired: boolean }[]
      >`SELECT pg_try_advisory_lock(hashtext(${'image-lock'})) AS "acquired"`;
      const other = await prisma.$queryRaw<
        { acquired: boolean }[]
      >`SELECT pg_try_advisory_lock(hashtext(${'other-image-lock'})) AS "acquired"`;
      if (other[0]?.acquired)
        await prisma.$executeRaw`SELECT pg_advisory_unlock(hashtext(${'other-image-lock'}))`;
      return { same: same[0]?.acquired, other: other[0]?.acquired };
    });
    expect(first).toEqual({ same: false, other: true });
    const released = await prisma.$queryRaw<
      { acquired: boolean }[]
    >`SELECT pg_try_advisory_lock(hashtext(${'image-lock'})) AS "acquired"`;
    expect(released[0]?.acquired).toBe(true);
    await prisma.$executeRaw`SELECT pg_advisory_unlock(hashtext(${'image-lock'}))`;
  });

  it('releases an advisory transaction lock on rollback', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$queryRaw`WITH advisory_lock AS MATERIALIZED (SELECT pg_advisory_xact_lock(hashtext(${'rollback-image-lock'}))) SELECT 1::integer AS "acquired" FROM advisory_lock`;
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    const rows = await prisma.$queryRaw<
      { acquired: boolean }[]
    >`SELECT pg_try_advisory_lock(hashtext(${'rollback-image-lock'})) AS "acquired"`;
    expect(rows[0]?.acquired).toBe(true);
    await prisma.$executeRaw`SELECT pg_advisory_unlock(hashtext(${'rollback-image-lock'}))`;
  });
});
