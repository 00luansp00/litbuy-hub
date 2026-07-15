import type { Request } from 'express';
import type { Device, Session, User } from '@prisma/client';

export interface AuthRuntimeConfig {
  accessSecret: string;
  accessTtlSeconds: number;
  refreshTtlDays: number;
  refreshPepper: string;
  verificationPepper: string;
  devicePepper: string;
  csrfPepper: string;
  ipPepper: string;
  emailVerificationTtlMinutes: number;
  deviceApprovalTtlMinutes: number;
  passwordResetTtlMinutes: number;
  maxAttempts: number;
  loginLockMinutes: number;
  refreshCookieName: string;
  deviceCookieName: string;
  csrfCookieName: string;
  cookieSecure: boolean;
  cookieSameSite: 'lax' | 'strict' | 'none';
  cookieDomain?: string;
  emailDeliveryMode: 'memory' | 'console' | 'disabled';
  smsDeliveryMode: 'memory' | 'disabled';
  phoneVerificationTtlMinutes: number;
  phoneResendCooldownSeconds: number;
  emailChangeTtlMinutes: number;
  sensitiveChangeHoldHours: number;
  twoFactorCodeTtlMinutes: number;
  twoFactorResendCooldownSeconds: number;
  twoFactorMaxAttempts: number;
  twoFactorRecoveryCodeCount: number;
  twoFactorRecoveryPepper: string;
  stepUpTokenPepper: string;
  stepUpGrantTtlMinutes: number;
  stepUpResendCooldownSeconds: number;
  stepUpMaxAttempts: number;
  currentTermsVersion: string;
  currentPrivacyVersion: string;
}

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  type: 'access';
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  auth?: { userId: string; sessionId: string; deviceId: string };
}

export type SafeMetadata = Record<string, string | number | boolean | null>;
export type UserWithCredential = User & {
  passwordCredential: {
    passwordHash: string;
    failedLoginAttempts: number;
    lockedUntil: Date | null;
  } | null;
};
export type SessionWithUserDevice = Session & { user: User; device: Device };
