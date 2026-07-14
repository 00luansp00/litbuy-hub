import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import argon2 from 'argon2';

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();
export const sanitizeUserAgent = (ua?: string): string | null =>
  ua ? ua.replace(/[\r\n\t]/g, ' ').slice(0, 255) : null;
export const randomToken = (bytes = 32): string => randomBytes(bytes).toString('base64url');
export const hmacToken = (token: string, pepper: string): string =>
  createHmac('sha256', pepper).update(token).digest('hex');
export const safeEqual = (a: string, b: string): boolean => {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
};
export const hashPassword = (password: string) => argon2.hash(password, { type: argon2.argon2id });
export const verifyPassword = (hash: string, password: string) => argon2.verify(hash, password);
export function parseBirthDate(input: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  const [y, m, d] = input.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}
export function isAtLeast18(input: string, now = new Date()): boolean {
  const b = parseBirthDate(input);
  if (!b) return false;
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (b > today) return false;
  let age = today.getUTCFullYear() - b.getUTCFullYear();
  const m = today.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && today.getUTCDate() < b.getUTCDate())) age--;
  return age >= 18;
}
export function validatePasswordPolicy(password: string): boolean {
  return password.length >= 12 && password.length <= 128 && password.trim().length > 0;
}
export function sanitizeMetadata(v: Record<string, unknown> = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v))
    if (!/token|secret|password|cookie|url/i.test(k))
      out[k] = typeof val === 'string' ? val.slice(0, 200) : val;
  return out;
}
