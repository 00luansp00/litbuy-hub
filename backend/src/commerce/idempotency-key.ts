import { createHash } from 'node:crypto';
import { AppError } from '../common/errors/app-error';

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
export type ParsedIdempotencyKey = Readonly<{ hash: string }>;
export function parseIdempotencyKey(value: unknown): ParsedIdempotencyKey {
  if (value === undefined)
    throw new AppError('IDEMPOTENCY_KEY_REQUIRED', 'IDEMPOTENCY_KEY_REQUIRED', 400);
  if (typeof value !== 'string' || !/^[A-Za-z0-9._:-]{16,128}$/.test(value))
    throw new AppError('IDEMPOTENCY_KEY_INVALID', 'IDEMPOTENCY_KEY_INVALID', 400);
  return { hash: sha256(value) };
}
export function canonicalRequestHash(value: unknown) {
  const sort = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sort)
      : v && typeof v === 'object'
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, x]) => [k, sort(x)]),
          )
        : v;
  return sha256(JSON.stringify(sort(value)));
}
