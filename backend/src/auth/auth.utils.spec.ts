import {
  hmacToken,
  hashPassword,
  isAtLeast18,
  normalizeEmail,
  randomToken,
  sanitizeMetadata,
  validatePasswordPolicy,
  verifyPassword,
} from './auth.utils';
describe('auth utils', () => {
  it('normalizes email', () => expect(normalizeEmail(' Test@Email.COM ')).toBe('test@email.com'));
  it('validates age boundaries', () => {
    const now = new Date(Date.UTC(2026, 6, 14));
    expect(isAtLeast18('2008-07-14', now)).toBe(true);
    expect(isAtLeast18('2008-07-15', now)).toBe(false);
    expect(isAtLeast18('2030-01-01', now)).toBe(false);
    expect(isAtLeast18('bad', now)).toBe(false);
  });
  it('hashes and verifies argon2id passwords', async () => {
    const h = await hashPassword('long password ok');
    expect(h).toContain('argon2id');
    expect(await verifyPassword(h, 'long password ok')).toBe(true);
  });
  it('generates hmac token hashes and strips sensitive metadata', () => {
    const t = randomToken();
    expect(Buffer.from(t, 'base64url').length).toBe(32);
    expect(hmacToken(t, 'pepper')).toHaveLength(64);
    expect(sanitizeMetadata({ token: 'x', safe: 'y' })).toEqual({ safe: 'y' });
  });
  it('validates password policy', () => {
    expect(validatePasswordPolicy(' '.repeat(12))).toBe(false);
    expect(validatePasswordPolicy('a'.repeat(12))).toBe(true);
    expect(validatePasswordPolicy('a'.repeat(129))).toBe(false);
  });
});
