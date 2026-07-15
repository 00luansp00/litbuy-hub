import { Prisma } from '@prisma/client';
import {
  hmacToken,
  hashPassword,
  isAtLeast18,
  normalizeEmail,
  randomToken,
  sanitizeMetadata,
  validatePasswordPolicy,
  verifyPassword,
  normalizeBrazilianMobilePhone,
  maskBrazilianPhone,
  generateSmsCode,
  challengeSecretHash,
  targetHash,
  applySensitiveHold,
  isUniqueConstraintError,
  generateTwoFactorCode,
  generateRecoveryCode,
  recoveryCodeHash,
  twoFactorChallengeHash,
  stepUpTokenHash,
  stepUpScopeHash,
  resolveStepUpScopeFromHash,
  twoFactorMethodChangeTargetHash,
  resolveTwoFactorMethodFromHash,
  stepUpTtlExpiresAt,
  stepUpChallengeLockKey,
  sanitizeStepUpFailureMetadata,
} from './auth.utils';
import { AUTH_DUMMY_PASSWORD_HASH } from './auth.service';
describe('auth utils', () => {
  it('normalizes email', () => expect(normalizeEmail(' Test@Email.COM ')).toBe('test@email.com'));
  it('validates age boundaries', () => {
    const now = new Date();
    const exactly18 = new Date(
      Date.UTC(now.getUTCFullYear() - 18, now.getUTCMonth(), now.getUTCDate()),
    )
      .toISOString()
      .slice(0, 10);
    const oneDayBefore18 = new Date(
      Date.UTC(now.getUTCFullYear() - 18, now.getUTCMonth(), now.getUTCDate() + 1),
    )
      .toISOString()
      .slice(0, 10);
    const future = new Date(Date.UTC(now.getUTCFullYear() + 1, now.getUTCMonth(), now.getUTCDate()))
      .toISOString()
      .slice(0, 10);
    expect(isAtLeast18(exactly18, now)).toBe(true);
    expect(isAtLeast18(oneDayBefore18, now)).toBe(false);
    expect(isAtLeast18(future, now)).toBe(false);
    expect(isAtLeast18('bad', now)).toBe(false);
  });
  it('uses a reusable dummy Argon2id verification hash for nonexistent login mitigation', async () => {
    expect(AUTH_DUMMY_PASSWORD_HASH).toContain('argon2id');
    expect(await verifyPassword(AUTH_DUMMY_PASSWORD_HASH, 'wrong password')).toBe(false);
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
  it('normalizes and masks Brazilian mobile phones', () => {
    expect(normalizeBrazilianMobilePhone('(17) 99999-1234')).toBe('+5517999991234');
    expect(normalizeBrazilianMobilePhone('+1 415 555 2671')).toBeNull();
    expect(normalizeBrazilianMobilePhone('(17) 3333-1234')).toBeNull();
    expect(maskBrazilianPhone('+5517999991234')).toBe('+55 17 *****-1234');
  });
  it('generates SMS/2FA code and challenge-bound hashes', () => {
    expect(generateTwoFactorCode()).toMatch(/^\d{6}$/);
    expect(twoFactorChallengeHash('challenge-a', '123456', 'pepper')).not.toBe(
      twoFactorChallengeHash('challenge-b', '123456', 'pepper'),
    );
    expect(generateSmsCode()).toMatch(/^\d{6}$/);
    expect(challengeSecretHash('a', '123456', 'pepper')).not.toBe(
      challengeSecretHash('b', '123456', 'pepper'),
    );
    expect(targetHash('phone', '+5517999991234', 'pepper')).not.toBe(
      targetHash('email', '+5517999991234', 'pepper'),
    );
  });
  it('generates recovery codes with domain-separated HMAC hashes', () => {
    const code = generateRecoveryCode();
    expect(code).toMatch(/^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/);
    expect(recoveryCodeHash(code, 'pepper')).toHaveLength(64);
    expect(recoveryCodeHash(code, 'pepper')).not.toBe(hmacToken(code, 'pepper'));
  });

  it('applies sensitive holds without reducing existing longer hold', () => {
    const now = new Date('2026-07-14T00:00:00Z');
    const next = applySensitiveHold(null, now, 48);
    expect(next.toISOString()).toBe('2026-07-16T00:00:00.000Z');
    const later = new Date('2026-07-20T00:00:00Z');
    expect(applySensitiveHold(later, now, 48)).toBe(later);
  });

  it('recognizes only Prisma P2002 unique constraint errors', () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
    });
    const p2003 = new Prisma.PrismaClientKnownRequestError('Foreign key failed', {
      code: 'P2003',
      clientVersion: 'test',
    });
    expect(isUniqueConstraintError(p2002)).toBe(true);
    expect(isUniqueConstraintError(p2003)).toBe(false);
    expect(isUniqueConstraintError(new Error('P2002'))).toBe(false);
  });

  it('validates password policy', () => {
    expect(validatePasswordPolicy(' '.repeat(12))).toBe(false);
    expect(validatePasswordPolicy('a'.repeat(12))).toBe(true);
    expect(validatePasswordPolicy('a'.repeat(129))).toBe(false);
  });

  it('generates and resolves step-up hashes with dedicated domain separation', () => {
    const pepper = 'step-up-pepper';
    const otherPepper = 'other-pepper';
    const tokenHash = stepUpTokenHash('opaque-token', pepper);
    expect(tokenHash).toHaveLength(64);
    expect(tokenHash).not.toBe(hmacToken('opaque-token', pepper));
    expect(tokenHash).not.toBe(stepUpTokenHash('opaque-token', otherPepper));
    const methodHash = stepUpScopeHash('TWO_FACTOR_METHOD_CHANGE', pepper);
    const recoveryHash = stepUpScopeHash('TWO_FACTOR_RECOVERY_REGENERATE', pepper);
    expect(methodHash).not.toBe(recoveryHash);
    expect(resolveStepUpScopeFromHash(methodHash, pepper)).toBe('TWO_FACTOR_METHOD_CHANGE');
    expect(resolveStepUpScopeFromHash(recoveryHash, pepper)).toBe('TWO_FACTOR_RECOVERY_REGENERATE');
    expect(
      resolveStepUpScopeFromHash(stepUpScopeHash('TWO_FACTOR_METHOD_CHANGE', otherPepper), pepper),
    ).toBeNull();
    expect(resolveStepUpScopeFromHash('unknown', pepper)).toBeNull();
  });

  it('resolves method-change target hashes exactly without fallback', () => {
    const pepper = 'step-up-pepper';
    const emailHash = twoFactorMethodChangeTargetHash('EMAIL', pepper);
    const smsHash = twoFactorMethodChangeTargetHash('SMS', pepper);
    expect(emailHash).not.toBe(smsHash);
    expect(resolveTwoFactorMethodFromHash(emailHash, pepper)).toBe('EMAIL');
    expect(resolveTwoFactorMethodFromHash(smsHash, pepper)).toBe('SMS');
    expect(resolveTwoFactorMethodFromHash('unknown', pepper)).toBeNull();
  });

  it('computes step-up ttl, lock keys and sanitized failure metadata', () => {
    const now = new Date('2026-07-15T00:00:00Z');
    expect(stepUpTtlExpiresAt(now, 10).toISOString()).toBe('2026-07-15T00:10:00.000Z');
    expect(stepUpChallengeLockKey('session-id', 'device-id', 'TWO_FACTOR_METHOD_CHANGE')).toBe(
      'step-up-challenge:session-id:device-id:TWO_FACTOR_METHOD_CHANGE',
    );
    expect(
      sanitizeStepUpFailureMetadata('TWO_FACTOR_METHOD_CHANGE', 'INVALID_CODE', 'FAILURE'),
    ).toEqual({
      scope: 'TWO_FACTOR_METHOD_CHANGE',
      reason: 'INVALID_CODE',
      outcome: 'FAILURE',
    });
  });
});
