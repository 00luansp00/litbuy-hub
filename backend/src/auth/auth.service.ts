import crypto from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Device, Prisma, SecurityEventOutcome, SecurityEventType, User } from '@prisma/client';
import type { CookieOptions, Request, Response } from 'express';
import { AppLogger } from '../common/logging/app-logger.service';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import type {
  AuthRuntimeConfig,
  SafeMetadata,
  SessionWithUserDevice,
  UserWithCredential,
} from './auth.types';
import {
  ChangePasswordDto,
  EmailChangeConfirmDto,
  EmailChangeRequestDto,
  PhoneRequestDto,
  PhoneVerifyDto,
  EmailDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  TokenDto,
} from './dto';
import {
  buildChallengeToken,
  hmacToken,
  hashPassword,
  isAtLeast18,
  normalizeEmail,
  parseBirthDate,
  randomToken,
  safeEqual,
  sanitizeMetadata,
  sanitizeUserAgent,
  normalizeBrazilianMobilePhone,
  maskBrazilianPhone,
  generateSmsCode,
  challengeSecretHash,
  targetHash,
  applySensitiveHold,
  splitChallengeToken,
  validatePasswordPolicy,
  verifyPassword,
} from './auth.utils';

export interface AuthEmailPort {
  send(
    to: string,
    purpose:
      | 'EMAIL_VERIFICATION'
      | 'DEVICE_APPROVAL'
      | 'PASSWORD_RESET'
      | 'PASSWORD_CHANGED_NOTICE'
      | 'EMAIL_CHANGE_CONFIRM_CURRENT'
      | 'EMAIL_CHANGE_CONFIRM_NEW'
      | 'EMAIL_CHANGED_NOTICE'
      | 'PHONE_CHANGED_NOTICE',
    token?: string,
  ): void;
}

@Injectable()
export class AuthMailer implements AuthEmailPort, OnModuleInit {
  readonly sent: {
    to: string;
    purpose:
      | 'EMAIL_VERIFICATION'
      | 'DEVICE_APPROVAL'
      | 'PASSWORD_RESET'
      | 'PASSWORD_CHANGED_NOTICE'
      | 'EMAIL_CHANGE_CONFIRM_CURRENT'
      | 'EMAIL_CHANGE_CONFIRM_NEW'
      | 'EMAIL_CHANGED_NOTICE'
      | 'PHONE_CHANGED_NOTICE';
    token?: string;
  }[] = [];

  onModuleInit(): void {
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.AUTH_EMAIL_DELIVERY_MODE !== 'disabled'
    ) {
      throw new ServiceUnavailableException('Auth email provider unavailable');
    }
  }

  send(
    to: string,
    purpose:
      | 'EMAIL_VERIFICATION'
      | 'DEVICE_APPROVAL'
      | 'PASSWORD_RESET'
      | 'PASSWORD_CHANGED_NOTICE'
      | 'EMAIL_CHANGE_CONFIRM_CURRENT'
      | 'EMAIL_CHANGE_CONFIRM_NEW'
      | 'EMAIL_CHANGED_NOTICE'
      | 'PHONE_CHANGED_NOTICE',
    token?: string,
  ): void {
    if (process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException('Auth email provider unavailable');
    }
    if (process.env.AUTH_EMAIL_DELIVERY_MODE === 'memory') {
      this.sent.push({ to, purpose, token });
    }
  }
}

export interface AuthSmsPort {
  sent: { to: string; purpose: 'PHONE_VERIFICATION' | 'SECURITY_ALERT'; code?: string }[];
  send(to: string, purpose: 'PHONE_VERIFICATION' | 'SECURITY_ALERT', code?: string): void;
}

@Injectable()
export class MemoryAuthSmsPort implements AuthSmsPort, OnModuleInit {
  readonly sent: { to: string; purpose: 'PHONE_VERIFICATION' | 'SECURITY_ALERT'; code?: string }[] =
    [];
  onModuleInit(): void {
    if (process.env.NODE_ENV === 'production' && process.env.AUTH_SMS_DELIVERY_MODE === 'memory') {
      throw new ServiceUnavailableException('Auth SMS memory adapter unavailable in production');
    }
  }
  send(to: string, purpose: 'PHONE_VERIFICATION' | 'SECURITY_ALERT', code?: string): void {
    if (process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException('Auth SMS provider unavailable');
    }
    if (process.env.AUTH_SMS_DELIVERY_MODE === 'memory') this.sent.push({ to, purpose, code });
    if (
      process.env.AUTH_SMS_DELIVERY_MODE !== 'memory' &&
      process.env.AUTH_SMS_DELIVERY_MODE !== 'disabled'
    ) {
      throw new ServiceUnavailableException('Auth SMS provider unavailable');
    }
  }
}

export const AUTH_DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$4UqJVYzZ6DnMEgyl7Ymlaw$jjSuCWmH9Jrt8sAFwAXseW3spqOkXLNtVIhzALWEA/U';

interface EventInput {
  userId?: string | null;
  sessionId?: string | null;
  deviceId?: string | null;
  eventType: SecurityEventType;
  outcome?: SecurityEventOutcome;
  metadata?: SafeMetadata;
  req?: Request;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly mailer: AuthMailer,
    @Inject('AuthSmsPort') private readonly sms: AuthSmsPort,
    private readonly logger: AppLogger,
  ) {}

  private authConfig(): AuthRuntimeConfig {
    return this.config.getOrThrow<AuthRuntimeConfig>('auth');
  }

  private cookieOptions(httpOnly = true): CookieOptions {
    const c = this.authConfig();
    return {
      httpOnly,
      secure: c.cookieSecure,
      sameSite: c.cookieSameSite,
      domain: c.cookieDomain,
      path: '/api/v1/auth',
    };
  }

  private clearCookieOptions(): CookieOptions {
    return this.cookieOptions(true);
  }

  private setDevice(res: Response, token: string): void {
    res.cookie(this.authConfig().deviceCookieName, token, {
      ...this.cookieOptions(true),
      maxAge: 400 * 24 * 3600_000,
    });
  }

  private setRefreshAndCsrfCookies(res: Response, refresh: string, csrf: string): void {
    const c = this.authConfig();
    res.cookie(c.refreshCookieName, refresh, {
      ...this.cookieOptions(true),
      maxAge: c.refreshTtlDays * 86400_000,
    });
    res.cookie(c.csrfCookieName, csrf, {
      ...this.cookieOptions(false),
      maxAge: c.refreshTtlDays * 86400_000,
    });
  }

  private clearAuth(res: Response): void {
    const c = this.authConfig();
    res.clearCookie(c.refreshCookieName, this.clearCookieOptions());
    res.clearCookie(c.csrfCookieName, this.clearCookieOptions());
  }

  private ipHash(req: Request): string {
    return hmacToken(req.ip ?? 'unknown', this.authConfig().ipPepper);
  }

  private opaquePart(value: string): string {
    return hmacToken(value, this.authConfig().ipPepper).slice(0, 32);
  }

  private securityEventData(input: EventInput): Prisma.SecurityEventUncheckedCreateInput {
    return {
      userId: input.userId ?? undefined,
      sessionId: input.sessionId ?? undefined,
      deviceId: input.deviceId ?? undefined,
      eventType: input.eventType,
      outcome: input.outcome ?? 'SUCCESS',
      metadata: sanitizeMetadata(input.metadata) as Prisma.InputJsonValue,
      ipHash: input.req ? this.ipHash(input.req) : undefined,
      userAgent: sanitizeUserAgent(input.req?.headers['user-agent']),
    };
  }

  private async persistCriticalSecurityEvent(
    input: EventInput,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.securityEvent.create({ data: this.securityEventData(input) });
  }

  private async persistBestEffortSecurityEvent(
    input: EventInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    try {
      await client.securityEvent.create({ data: this.securityEventData(input) });
    } catch (error) {
      this.logger.warn('Failed to persist sanitized security event', {
        eventType: input.eventType,
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
    }
  }

  private async rate(parts: string[], limit: number, ttl: number): Promise<void> {
    const key = `rl:${parts.map((part) => this.opaquePart(part)).join(':')}`;
    try {
      const r = await this.redis.getClient();
      const n = await r.incr(key);
      if (n === 1) await r.expire(key, ttl);
      if (n > limit)
        throw new HttpException({ code: 'RATE_LIMITED' }, HttpStatus.TOO_MANY_REQUESTS);
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() === 429) throw error;
      this.logger.warn('Redis rate limit unavailable; failing open', {
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
    }
  }

  private async challenge(
    userId: string,
    purpose: 'EMAIL_VERIFICATION' | 'DEVICE_APPROVAL' | 'PASSWORD_RESET',
    minutes: number,
    deviceId?: string,
  ): Promise<string> {
    const c = this.authConfig();
    const secret = randomToken();
    const challenge = await this.prisma.verificationChallenge.create({
      data: {
        userId,
        deviceId,
        purpose,
        tokenHash: hmacToken(secret, c.verificationPepper),
        maxAttempts: c.maxAttempts,
        expiresAt: new Date(Date.now() + minutes * 60_000),
      },
    });
    await this.prisma.verificationChallenge.updateMany({
      where: { userId, purpose, deviceId, consumedAt: null, id: { not: challenge.id } },
      data: { consumedAt: new Date() },
    });
    return buildChallengeToken(challenge.id, secret);
  }

  private async validateChallenge(
    token: string,
    purpose: 'EMAIL_VERIFICATION' | 'DEVICE_APPROVAL' | 'PASSWORD_RESET',
  ): Promise<{ id: string; userId: string; deviceId: string | null; maxAttempts: number }> {
    const parts = splitChallengeToken(token);
    if (!parts) throw new BadRequestException({ code: 'INVALID_OR_EXPIRED_TOKEN' });
    const challenge = await this.prisma.verificationChallenge.findUnique({
      where: { id: parts.challengeId },
    });
    if (
      !challenge ||
      challenge.purpose !== purpose ||
      challenge.consumedAt ||
      challenge.expiresAt < new Date()
    ) {
      throw new BadRequestException({ code: 'INVALID_OR_EXPIRED_TOKEN' });
    }
    if (challenge.attempts >= challenge.maxAttempts) {
      throw new BadRequestException({ code: 'CHALLENGE_LOCKED' });
    }
    const expected = hmacToken(parts.secret, this.authConfig().verificationPepper);
    if (!safeEqual(expected, challenge.tokenHash)) {
      await this.prisma.verificationChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException({ code: 'INVALID_OR_EXPIRED_TOKEN' });
    }
    return {
      id: challenge.id,
      userId: challenge.userId,
      deviceId: challenge.deviceId,
      maxAttempts: challenge.maxAttempts,
    };
  }

  async register(dto: RegisterDto, req: Request, res: Response): Promise<{ message: string }> {
    const c = this.authConfig();
    await this.rate(['register', req.ip ?? 'unknown'], 10, 300);
    const email = normalizeEmail(dto.email);
    if (
      dto.termsVersion !== c.currentTermsVersion ||
      dto.privacyVersion !== c.currentPrivacyVersion
    ) {
      throw new BadRequestException({ code: 'OUTDATED_TERMS_OR_PRIVACY' });
    }
    if (
      !dto.termsAccepted ||
      !dto.privacyAccepted ||
      !isAtLeast18(dto.birthDate) ||
      !validatePasswordPolicy(dto.password)
    ) {
      throw new BadRequestException({ code: 'INVALID_REGISTRATION' });
    }
    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      const deviceToken = randomToken();
      const tokenHash = hmacToken(deviceToken, c.devicePepper);
      user = await this.prisma.user.create({
        data: {
          email,
          birthDate: parseBirthDate(dto.birthDate)!,
          termsVersion: c.currentTermsVersion,
          termsAcceptedAt: new Date(),
          privacyVersion: c.currentPrivacyVersion,
          privacyAcceptedAt: new Date(),
          passwordCredential: { create: { passwordHash: await hashPassword(dto.password) } },
          devices: {
            create: {
              tokenHash,
              displayName: dto.deviceName,
              userAgent: sanitizeUserAgent(req.headers['user-agent']),
              status: 'APPROVED',
              isInitialDevice: true,
              approvedAt: new Date(),
            },
          },
        },
      });
      this.setDevice(res, deviceToken);
      const token = await this.challenge(
        user.id,
        'EMAIL_VERIFICATION',
        c.emailVerificationTtlMinutes,
      );
      this.mailer.send(email, 'EMAIL_VERIFICATION', token);
      await this.persistBestEffortSecurityEvent({ userId: user.id, eventType: 'REGISTERED', req });
      await this.persistBestEffortSecurityEvent({
        userId: user.id,
        eventType: 'EMAIL_VERIFICATION_REQUESTED',
        req,
      });
    }
    return { message: 'Se os dados forem válidos, enviaremos as instruções por e-mail.' };
  }

  async verifyEmail(dto: TokenDto, req: Request): Promise<{ message: string }> {
    await this.rate(['email-verify', req.ip ?? 'unknown'], 20, 300);
    const challenge = await this.validateChallenge(dto.token, 'EMAIL_VERIFICATION');
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: challenge.userId },
        data: { emailVerifiedAt: new Date(), status: 'ACTIVE' },
      });
      await tx.verificationChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date(), attempts: { increment: 1 } },
      });
      await this.persistBestEffortSecurityEvent(
        { userId: challenge.userId, eventType: 'EMAIL_VERIFIED', req },
        tx,
      );
    });
    return { message: 'E-mail confirmado.' };
  }

  async resendEmail(dto: EmailDto, req: Request): Promise<{ message: string }> {
    const email = normalizeEmail(dto.email);
    await this.rate(['email-resend', req.ip ?? 'unknown', email], 5, 300);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && !user.emailVerifiedAt) {
      const token = await this.challenge(
        user.id,
        'EMAIL_VERIFICATION',
        this.authConfig().passwordResetTtlMinutes,
      );
      this.mailer.send(email, 'EMAIL_VERIFICATION', token);
      await this.persistBestEffortSecurityEvent({
        userId: user.id,
        eventType: 'EMAIL_VERIFICATION_REQUESTED',
        req,
      });
    }
    return { message: 'Se a conta existir, enviaremos as instruções por e-mail.' };
  }

  private async loginFailure(user: UserWithCredential | null, req: Request): Promise<never> {
    const c = this.authConfig();
    if (user?.passwordCredential) {
      const attempts = user.passwordCredential.failedLoginAttempts + 1;
      const locked = attempts >= c.maxAttempts;
      await this.prisma.passwordCredential.update({
        where: { userId: user.id },
        data: {
          failedLoginAttempts: attempts,
          lockedUntil: locked ? new Date(Date.now() + c.loginLockMinutes * 60_000) : undefined,
        },
      });
      await this.persistBestEffortSecurityEvent({
        userId: user.id,
        eventType: locked ? 'LOGIN_LOCKED' : 'LOGIN_FAILED',
        outcome: locked ? 'BLOCKED' : 'FAILURE',
        req,
      });
    }
    throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });
  }

  private async resolveLoginDevice(
    user: User,
    dto: LoginDto,
    req: Request,
    res: Response,
  ): Promise<Device> {
    const c = this.authConfig();
    const cookieToken = req.cookies?.[c.deviceCookieName] as string | undefined;
    if (cookieToken) {
      const existing = await this.prisma.device.findUnique({
        where: { tokenHash: hmacToken(cookieToken, c.devicePepper) },
      });
      if (existing?.userId === user.id) return existing;
      if (existing && existing.userId !== user.id) {
        const replacement = randomToken();
        this.setDevice(res, replacement);
        return this.prisma.device.create({
          data: {
            userId: user.id,
            tokenHash: hmacToken(replacement, c.devicePepper),
            displayName: dto.deviceName,
            userAgent: sanitizeUserAgent(req.headers['user-agent']),
            status: 'PENDING',
          },
        });
      }
    }
    const token = randomToken();
    this.setDevice(res, token);
    return this.prisma.device.create({
      data: {
        userId: user.id,
        tokenHash: hmacToken(token, c.devicePepper),
        displayName: dto.deviceName,
        userAgent: sanitizeUserAgent(req.headers['user-agent']),
        status: 'PENDING',
      },
    });
  }

  async login(dto: LoginDto, req: Request, res: Response): Promise<unknown> {
    const email = normalizeEmail(dto.email);
    await this.rate(['login', req.ip ?? 'unknown', email], 10, 300);
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { passwordCredential: true },
    });
    if (!user || !user.passwordCredential) {
      await verifyPassword(AUTH_DUMMY_PASSWORD_HASH, dto.password);
      return this.loginFailure(null, req);
    }
    if (user.passwordCredential.lockedUntil && user.passwordCredential.lockedUntil > new Date()) {
      await this.persistBestEffortSecurityEvent({
        userId: user.id,
        eventType: 'LOGIN_LOCKED',
        outcome: 'BLOCKED',
        req,
      });
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });
    }
    if (!(await verifyPassword(user.passwordCredential.passwordHash, dto.password)))
      return this.loginFailure(user, req);
    if (user.status !== 'ACTIVE' || !user.emailVerifiedAt)
      throw new ForbiddenException({ code: 'EMAIL_NOT_VERIFIED' });
    const device = await this.resolveLoginDevice(user, dto, req, res);
    if (device.status === 'REVOKED') throw new ForbiddenException({ code: 'DEVICE_REVOKED' });
    if (device.status !== 'APPROVED') {
      const token = await this.challenge(
        user.id,
        'DEVICE_APPROVAL',
        this.authConfig().deviceApprovalTtlMinutes,
        device.id,
      );
      this.mailer.send(user.email, 'DEVICE_APPROVAL', token);
      await this.persistBestEffortSecurityEvent({
        userId: user.id,
        deviceId: device.id,
        eventType: 'DEVICE_APPROVAL_REQUIRED',
        outcome: 'PENDING',
        req,
      });
      await this.persistBestEffortSecurityEvent({
        userId: user.id,
        deviceId: device.id,
        eventType: 'DEVICE_APPROVAL_REQUESTED',
        outcome: 'PENDING',
        req,
      });
      throw new HttpException({ code: 'DEVICE_APPROVAL_REQUIRED' }, HttpStatus.ACCEPTED);
    }
    await this.prisma.passwordCredential.update({
      where: { userId: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
    await this.prisma.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
    await this.persistBestEffortSecurityEvent({
      userId: user.id,
      deviceId: device.id,
      eventType: 'LOGIN_SUCCEEDED',
      req,
    });
    return this.createSession(user, device, res, req);
  }

  private async createSession(
    user: User,
    device: Device,
    res: Response,
    req: Request,
  ): Promise<Record<string, unknown>> {
    const c = this.authConfig();
    const refresh = randomToken();
    const csrf = randomToken();
    const familyId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + c.refreshTtlDays * 86400_000);
    const session = await this.prisma.$transaction(async (tx) => {
      const created = await tx.session.create({
        data: {
          userId: user.id,
          deviceId: device.id,
          refreshTokenHash: hmacToken(refresh, c.refreshPepper),
          refreshTokenFamilyId: familyId,
          csrfTokenHash: hmacToken(csrf, c.csrfPepper),
          expiresAt,
        },
      });
      await tx.sessionRefreshToken.create({
        data: {
          sessionId: created.id,
          familyId,
          tokenHash: hmacToken(refresh, c.refreshPepper),
          expiresAt,
        },
      });
      await this.persistBestEffortSecurityEvent(
        {
          userId: user.id,
          sessionId: created.id,
          deviceId: device.id,
          eventType: 'SESSION_CREATED',
          req,
        },
        tx,
      );
      return created;
    });
    this.setRefreshAndCsrfCookies(res, refresh, csrf);
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, sid: session.id, type: 'access' },
      { secret: c.accessSecret, expiresIn: c.accessTtlSeconds },
    );
    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        emailVerified: true,
        phoneVerified: false,
        birthDate: user.birthDate,
        status: user.status,
        createdAt: user.createdAt,
      },
    };
  }

  async approveDevice(dto: TokenDto, req: Request): Promise<{ message: string }> {
    await this.rate(['device-approve', req.ip ?? 'unknown'], 20, 300);
    const challenge = await this.validateChallenge(dto.token, 'DEVICE_APPROVAL');
    if (!challenge.deviceId) throw new BadRequestException({ code: 'INVALID_OR_EXPIRED_TOKEN' });
    await this.prisma.$transaction(async (tx) => {
      await tx.device.update({
        where: { id: challenge.deviceId! },
        data: { status: 'APPROVED', approvedAt: new Date() },
      });
      await tx.verificationChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date(), attempts: { increment: 1 } },
      });
      await this.persistBestEffortSecurityEvent(
        {
          userId: challenge.userId,
          deviceId: challenge.deviceId,
          eventType: 'DEVICE_APPROVED',
          req,
        },
        tx,
      );
    });
    return { message: 'Dispositivo aprovado. Faça login novamente.' };
  }

  async resendDevice(dto: EmailDto, req: Request): Promise<{ message: string }> {
    const email = normalizeEmail(dto.email);
    await this.rate(['device-resend', req.ip ?? 'unknown', email], 5, 300);
    const c = this.authConfig();
    const raw = req.cookies?.[c.deviceCookieName] as string | undefined;
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && raw) {
      const device = await this.prisma.device.findUnique({
        where: { tokenHash: hmacToken(raw, c.devicePepper) },
      });
      if (device && device.userId === user.id && device.status === 'PENDING') {
        const token = await this.challenge(
          user.id,
          'DEVICE_APPROVAL',
          c.deviceApprovalTtlMinutes,
          device.id,
        );
        this.mailer.send(email, 'DEVICE_APPROVAL', token);
        await this.persistBestEffortSecurityEvent({
          userId: user.id,
          deviceId: device.id,
          eventType: 'DEVICE_APPROVAL_REQUESTED',
          req,
        });
      }
    }
    return { message: 'Se a conta e o dispositivo existirem, enviaremos as instruções.' };
  }

  private async revokeFamilyForReuse(
    token: { sessionId: string; familyId: string },
    req: Request,
    res: Response,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const session = await tx.session.update({
        where: { id: token.sessionId },
        data: { revokedAt: new Date(), revocationReason: 'REFRESH_TOKEN_REUSE' },
      });
      await tx.sessionRefreshToken.updateMany({
        where: { familyId: token.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.persistCriticalSecurityEvent(
        {
          userId: session.userId,
          sessionId: session.id,
          deviceId: session.deviceId,
          eventType: 'REFRESH_TOKEN_REUSE_DETECTED',
          outcome: 'CRITICAL',
          req,
        },
        tx,
      );
      await this.persistCriticalSecurityEvent(
        {
          userId: session.userId,
          sessionId: session.id,
          deviceId: session.deviceId,
          eventType: 'SESSION_REVOKED',
          outcome: 'CRITICAL',
          req,
        },
        tx,
      );
    });
    this.clearAuth(res);
  }

  async refresh(req: Request, res: Response): Promise<{ accessToken: string }> {
    const c = this.authConfig();
    await this.rate(['refresh', req.ip ?? 'unknown'], 60, 60);
    const raw = req.cookies?.[c.refreshCookieName] as string | undefined;
    const csrf = req.cookies?.[c.csrfCookieName] as string | undefined;
    const header = req.headers['x-csrf-token'];
    if (!raw || !csrf || typeof header !== 'string' || !safeEqual(csrf, header))
      throw new UnauthorizedException({ code: 'INVALID_SESSION' });
    const tokenRecord = await this.prisma.sessionRefreshToken.findUnique({
      where: { tokenHash: hmacToken(raw, c.refreshPepper) },
      include: { session: { include: { user: true, device: true } } },
    });
    if (!tokenRecord) throw new UnauthorizedException({ code: 'INVALID_SESSION' });
    if (tokenRecord.usedAt || tokenRecord.revokedAt) {
      await this.revokeFamilyForReuse(tokenRecord, req, res);
      throw new UnauthorizedException({ code: 'INVALID_SESSION' });
    }
    const sess: SessionWithUserDevice = tokenRecord.session;
    if (
      tokenRecord.expiresAt < new Date() ||
      sess.revokedAt ||
      sess.expiresAt < new Date() ||
      sess.device.status !== 'APPROVED' ||
      !safeEqual(hmacToken(csrf, c.csrfPepper), sess.csrfTokenHash)
    ) {
      this.clearAuth(res);
      throw new UnauthorizedException({ code: 'INVALID_SESSION' });
    }
    const refresh = randomToken();
    const newCsrf = randomToken();
    const newHash = hmacToken(refresh, c.refreshPepper);
    const acquired = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const claim = await tx.sessionRefreshToken.updateMany({
        where: { id: tokenRecord.id, usedAt: null, revokedAt: null },
        data: { usedAt: now },
      });
      if (claim.count !== 1) return false;
      const next = await tx.sessionRefreshToken.create({
        data: {
          sessionId: sess.id,
          familyId: tokenRecord.familyId,
          tokenHash: newHash,
          expiresAt: sess.expiresAt,
        },
      });
      await tx.sessionRefreshToken.update({
        where: { id: tokenRecord.id },
        data: { replacedByTokenId: next.id },
      });
      await tx.session.update({
        where: { id: sess.id },
        data: {
          refreshTokenHash: newHash,
          csrfTokenHash: hmacToken(newCsrf, c.csrfPepper),
          lastUsedAt: now,
        },
      });
      await this.persistBestEffortSecurityEvent(
        {
          userId: sess.userId,
          sessionId: sess.id,
          deviceId: sess.deviceId,
          eventType: 'SESSION_REFRESHED',
          req,
        },
        tx,
      );
      return true;
    });
    if (!acquired) {
      await this.revokeFamilyForReuse(tokenRecord, req, res);
      throw new UnauthorizedException({ code: 'INVALID_SESSION' });
    }
    this.setRefreshAndCsrfCookies(res, refresh, newCsrf);
    return {
      accessToken: await this.jwt.signAsync(
        { sub: sess.userId, sid: sess.id, type: 'access' },
        { secret: c.accessSecret, expiresIn: c.accessTtlSeconds },
      ),
    };
  }

  private async revokeSessions(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      sessions: { id: string; userId: string; deviceId: string; revokedAt: Date | null }[];
      reason: string;
      eventType?: SecurityEventType;
      req: Request;
      deviceId?: string | null;
      sessionId?: string | null;
    },
  ): Promise<void> {
    const now = new Date();
    for (const session of input.sessions) {
      if (!session.revokedAt) {
        await tx.session.update({
          where: { id: session.id },
          data: { revokedAt: now, revocationReason: input.reason },
        });
        await tx.sessionRefreshToken.updateMany({
          where: { sessionId: session.id, revokedAt: null },
          data: { revokedAt: now },
        });
        await this.persistCriticalSecurityEvent(
          {
            userId: session.userId,
            sessionId: session.id,
            deviceId: session.deviceId,
            eventType: 'SESSION_REVOKED',
            req: input.req,
          },
          tx,
        );
      }
    }
    if (input.eventType) {
      await this.persistCriticalSecurityEvent(
        {
          userId: input.userId,
          sessionId: input.sessionId,
          deviceId: input.deviceId,
          eventType: input.eventType,
          req: input.req,
        },
        tx,
      );
    }
  }

  async forgotPassword(dto: EmailDto, req: Request): Promise<{ message: string }> {
    const email = normalizeEmail(dto.email);
    await this.rate(['password-forgot', req.ip ?? 'unknown', email], 5, 300);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user?.emailVerifiedAt && user.status === 'ACTIVE') {
      const token = await this.challenge(
        user.id,
        'PASSWORD_RESET',
        this.authConfig().passwordResetTtlMinutes,
      );
      this.mailer.send(email, 'PASSWORD_RESET', token);
      await this.persistBestEffortSecurityEvent({
        userId: user.id,
        eventType: 'PASSWORD_RESET_REQUESTED',
        outcome: 'PENDING',
        req,
      });
    }
    return { message: 'Se a conta existir, enviaremos as instruções por e-mail.' };
  }

  async resetPassword(dto: ResetPasswordDto, req: Request): Promise<{ message: string }> {
    await this.rate(['password-reset', req.ip ?? 'unknown'], 10, 300);
    if (!validatePasswordPolicy(dto.newPassword))
      throw new BadRequestException({ code: 'WEAK_PASSWORD' });
    const challenge = await this.validateChallenge(dto.token, 'PASSWORD_RESET');
    const user = await this.prisma.user.findUnique({
      where: { id: challenge.userId },
      include: { passwordCredential: true },
    });
    if (!user?.passwordCredential)
      throw new BadRequestException({ code: 'INVALID_OR_EXPIRED_TOKEN' });
    if (await verifyPassword(user.passwordCredential.passwordHash, dto.newPassword))
      throw new BadRequestException({ code: 'PASSWORD_REUSE_NOT_ALLOWED' });
    const passwordHash = await hashPassword(dto.newPassword);
    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const acquired = await tx.verificationChallenge.updateMany({
        where: {
          id: challenge.id,
          purpose: 'PASSWORD_RESET',
          consumedAt: null,
          expiresAt: { gt: now },
          attempts: { lt: challenge.maxAttempts },
        },
        data: { consumedAt: now, attempts: { increment: 1 } },
      });
      if (acquired.count !== 1) {
        throw new BadRequestException({ code: 'INVALID_OR_EXPIRED_TOKEN' });
      }
      await tx.passwordCredential.update({
        where: { userId: user.id },
        data: {
          passwordHash,
          passwordChangedAt: now,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
      await tx.verificationChallenge.updateMany({
        where: {
          userId: user.id,
          purpose: 'PASSWORD_RESET',
          consumedAt: null,
          id: { not: challenge.id },
        },
        data: { consumedAt: now },
      });
      await this.startSensitiveHold(tx, user.id, req);
      const sessions = await tx.session.findMany({ where: { userId: user.id } });
      await this.revokeSessions(tx, {
        userId: user.id,
        sessions,
        reason: 'PASSWORD_RESET',
        eventType: 'PASSWORD_RESET_COMPLETED',
        req,
      });
    });
    return { message: 'Senha redefinida. Faça login novamente.' };
  }

  async changePassword(
    dto: ChangePasswordDto,
    auth: { userId: string; sessionId: string; deviceId: string },
    req: Request,
    res: Response,
  ): Promise<{ message: string }> {
    await this.rate(['password-change', req.ip ?? 'unknown', auth.userId], 10, 300);
    if (!validatePasswordPolicy(dto.newPassword))
      throw new BadRequestException({ code: 'WEAK_PASSWORD' });
    const credential = await this.prisma.passwordCredential.findUnique({
      where: { userId: auth.userId },
    });
    if (!credential || !(await verifyPassword(credential.passwordHash, dto.currentPassword)))
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });
    if (await verifyPassword(credential.passwordHash, dto.newPassword))
      throw new BadRequestException({ code: 'PASSWORD_REUSE_NOT_ALLOWED' });
    const passwordHash = await hashPassword(dto.newPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.passwordCredential.update({
        where: { userId: auth.userId },
        data: {
          passwordHash,
          passwordChangedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
      await this.startSensitiveHold(tx, auth.userId, req);
      const sessions = await tx.session.findMany({ where: { userId: auth.userId } });
      await this.revokeSessions(tx, {
        userId: auth.userId,
        sessions,
        reason: 'PASSWORD_CHANGED',
        eventType: 'PASSWORD_CHANGED',
        req,
      });
    });
    this.clearAuth(res);
    return { message: 'Senha alterada. Faça login novamente.' };
  }

  private safeSession(
    session: Prisma.SessionGetPayload<{ include: { device: true } }>,
    currentId: string,
  ) {
    return {
      id: session.id,
      deviceId: session.deviceId,
      deviceName: session.device.displayName,
      userAgent: sanitizeUserAgent(session.device.userAgent ?? undefined),
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt,
      expiresAt: session.expiresAt,
      current: session.id === currentId,
      revoked: !!session.revokedAt,
      revokedAt: session.revokedAt,
      revocationReason: session.revocationReason,
    };
  }

  async listSessions(auth: {
    userId: string;
    sessionId: string;
  }): Promise<{ sessions: unknown[] }> {
    const sessions = await this.prisma.session.findMany({
      where: { userId: auth.userId },
      include: { device: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { sessions: sessions.map((s) => this.safeSession(s, auth.sessionId)) };
  }

  async revokeSession(
    sessionId: string,
    auth: { userId: string; sessionId: string },
    req: Request,
    res: Response,
  ): Promise<{ message: string }> {
    await this.rate(['session-revoke', req.ip ?? 'unknown', auth.userId, sessionId], 20, 300);
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId: auth.userId },
    });
    if (session)
      await this.prisma.$transaction(async (tx) =>
        this.revokeSessions(tx, {
          userId: auth.userId,
          sessions: [session],
          reason: 'USER_REVOKED',
          req,
        }),
      );
    if (sessionId === auth.sessionId) this.clearAuth(res);
    return { message: 'Sessão revogada.' };
  }

  async logoutAll(
    auth: { userId: string },
    req: Request,
    res: Response,
  ): Promise<{ message: string }> {
    await this.rate(['logout-all', req.ip ?? 'unknown', auth.userId], 10, 300);
    await this.prisma.$transaction(async (tx) => {
      const sessions = await tx.session.findMany({ where: { userId: auth.userId } });
      await this.revokeSessions(tx, {
        userId: auth.userId,
        sessions,
        reason: 'LOGOUT_ALL',
        eventType: 'LOGOUT_ALL',
        req,
      });
    });
    this.clearAuth(res);
    return { message: 'Logout realizado em todos os dispositivos.' };
  }

  async listDevices(auth: { userId: string; deviceId: string }): Promise<{ devices: unknown[] }> {
    const devices = await this.prisma.device.findMany({
      where: { userId: auth.userId },
      orderBy: { firstSeenAt: 'desc' },
      take: 50,
    });
    return {
      devices: devices.map((d) => ({
        id: d.id,
        displayName: d.displayName,
        userAgent: sanitizeUserAgent(d.userAgent ?? undefined),
        status: d.status,
        isInitialDevice: d.isInitialDevice,
        approvedAt: d.approvedAt,
        firstSeenAt: d.firstSeenAt,
        lastSeenAt: d.lastSeenAt,
        revokedAt: d.revokedAt,
        current: d.id === auth.deviceId,
      })),
    };
  }

  async revokeDevice(
    deviceId: string,
    auth: { userId: string; deviceId: string },
    req: Request,
    res: Response,
  ): Promise<{ message: string }> {
    await this.rate(['device-revoke', req.ip ?? 'unknown', auth.userId, deviceId], 20, 300);
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, userId: auth.userId },
    });
    if (device)
      await this.prisma.$transaction(async (tx) => {
        const now = new Date();
        if (device.status !== 'REVOKED')
          await tx.device.update({
            where: { id: device.id },
            data: { status: 'REVOKED', revokedAt: now },
          });
        await tx.verificationChallenge.updateMany({
          where: { deviceId: device.id, purpose: 'DEVICE_APPROVAL', consumedAt: null },
          data: { consumedAt: now },
        });
        const sessions = await tx.session.findMany({
          where: { userId: auth.userId, deviceId: device.id },
        });
        await this.revokeSessions(tx, {
          userId: auth.userId,
          sessions,
          reason: 'DEVICE_REVOKED',
          eventType: 'DEVICE_REVOKED',
          deviceId: device.id,
          req,
        });
      });
    if (deviceId === auth.deviceId) {
      this.clearAuth(res);
      res.clearCookie(this.authConfig().deviceCookieName, this.clearCookieOptions());
    }
    return { message: 'Dispositivo revogado.' };
  }

  async logout(req: Request, res: Response): Promise<{ message: string }> {
    const c = this.authConfig();
    const raw = req.cookies?.[c.refreshCookieName] as string | undefined;
    if (!raw) {
      this.clearAuth(res);
      return { message: 'Logout realizado.' };
    }
    const csrf = req.cookies?.[c.csrfCookieName] as string | undefined;
    const header = req.headers['x-csrf-token'];
    if (!csrf || typeof header !== 'string' || !safeEqual(csrf, header))
      throw new UnauthorizedException({ code: 'INVALID_CSRF' });
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: hmacToken(raw, c.refreshPepper) },
    });
    if (session && !safeEqual(hmacToken(csrf, c.csrfPepper), session.csrfTokenHash))
      throw new UnauthorizedException({ code: 'INVALID_CSRF' });
    if (session && !session.revokedAt) {
      await this.prisma.$transaction(async (tx) => {
        await tx.session.update({
          where: { id: session.id },
          data: { revokedAt: new Date(), revocationReason: 'LOGOUT' },
        });
        await tx.sessionRefreshToken.updateMany({
          where: { sessionId: session.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await this.persistBestEffortSecurityEvent(
          {
            userId: session.userId,
            sessionId: session.id,
            deviceId: session.deviceId,
            eventType: 'LOGOUT',
            req,
          },
          tx,
        );
        await this.persistBestEffortSecurityEvent(
          {
            userId: session.userId,
            sessionId: session.id,
            deviceId: session.deviceId,
            eventType: 'SESSION_REVOKED',
            req,
          },
          tx,
        );
      });
    }
    this.clearAuth(res);
    return { message: 'Logout realizado.' };
  }

  private async assertCurrentPassword(userId: string, password: string): Promise<void> {
    const credential = await this.prisma.passwordCredential.findUnique({ where: { userId } });
    if (!credential || !(await verifyPassword(credential.passwordHash, password))) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });
    }
  }

  private async startSensitiveHold(
    tx: Prisma.TransactionClient,
    userId: string,
    req: Request,
  ): Promise<void> {
    const now = new Date();
    const u = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    await tx.user.update({
      where: { id: userId },
      data: {
        sensitiveActionHoldUntil: applySensitiveHold(
          u.sensitiveActionHoldUntil,
          now,
          this.authConfig().sensitiveChangeHoldHours,
        ),
        lastSensitiveChangeAt: now,
      },
    });
    await this.persistCriticalSecurityEvent(
      { userId, eventType: 'SENSITIVE_ACTION_HOLD_STARTED', req },
      tx,
    );
  }

  async requestPhone(
    dto: PhoneRequestDto,
    auth: { userId: string; sessionId: string; deviceId: string },
    req: Request,
  ): Promise<{ challengeId: string; expiresAt: Date; message: string }> {
    const phone = normalizeBrazilianMobilePhone(dto.phone);
    if (!phone) throw new BadRequestException({ code: 'INVALID_PHONE' });
    await this.rate(['phone-request', req.ip ?? 'unknown', auth.userId, phone], 5, 300);
    await this.assertCurrentPassword(auth.userId, dto.currentPassword);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.userId } });
    if (user.phoneE164 === phone && user.phoneVerifiedAt)
      throw new BadRequestException({ code: 'PHONE_ALREADY_VERIFIED' });
    if (await this.prisma.user.findFirst({ where: { phoneE164: phone, id: { not: auth.userId } } }))
      throw new BadRequestException({ code: 'PHONE_UNAVAILABLE' });
    const c = this.authConfig();
    const code = generateSmsCode();
    const expiresAt = new Date(Date.now() + c.phoneVerificationTtlMinutes * 60_000);
    const challenge = await this.prisma.verificationChallenge.create({
      data: {
        userId: auth.userId,
        deviceId: auth.deviceId,
        purpose: 'PHONE_VERIFICATION',
        tokenHash: 'pending',
        targetHash: targetHash('phone', phone, c.verificationPepper),
        maxAttempts: 5,
        expiresAt,
      },
    });
    await this.prisma.verificationChallenge.update({
      where: { id: challenge.id },
      data: { tokenHash: challengeSecretHash(challenge.id, code, c.verificationPepper) },
    });
    await this.prisma.verificationChallenge.updateMany({
      where: {
        userId: auth.userId,
        purpose: 'PHONE_VERIFICATION',
        consumedAt: null,
        id: { not: challenge.id },
      },
      data: { consumedAt: new Date() },
    });
    try {
      this.sms.send(phone, 'PHONE_VERIFICATION', code);
    } catch (e) {
      await this.prisma.verificationChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
      });
      throw e;
    }
    await this.persistBestEffortSecurityEvent({
      userId: auth.userId,
      sessionId: auth.sessionId,
      deviceId: auth.deviceId,
      eventType: 'PHONE_VERIFICATION_REQUESTED',
      outcome: 'PENDING',
      req,
    });
    return {
      challengeId: challenge.id,
      expiresAt,
      message: 'Se os dados forem válidos, enviaremos um código por SMS.',
    };
  }

  async verifyPhone(
    dto: PhoneVerifyDto,
    auth: { userId: string; sessionId: string; deviceId: string },
    req: Request,
    res: Response,
  ): Promise<{ message: string }> {
    const phone = normalizeBrazilianMobilePhone(dto.phone);
    if (!phone) throw new BadRequestException({ code: 'INVALID_PHONE' });
    await this.rate(['phone-verify', req.ip ?? 'unknown', auth.userId, dto.challengeId], 10, 300);
    const expectedTarget = targetHash('phone', phone, this.authConfig().verificationPepper);
    const ch = await this.prisma.verificationChallenge.findUnique({
      where: { id: dto.challengeId },
    });
    if (
      !ch ||
      ch.userId !== auth.userId ||
      ch.purpose !== 'PHONE_VERIFICATION' ||
      ch.targetHash !== expectedTarget ||
      ch.consumedAt ||
      ch.expiresAt < new Date()
    )
      throw new BadRequestException({ code: 'INVALID_OR_EXPIRED_CODE' });
    if (ch.attempts >= ch.maxAttempts) throw new BadRequestException({ code: 'CHALLENGE_LOCKED' });
    if (
      !safeEqual(
        challengeSecretHash(ch.id, dto.code, this.authConfig().verificationPepper),
        ch.tokenHash,
      )
    ) {
      await this.prisma.verificationChallenge.update({
        where: { id: ch.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException({ code: 'INVALID_OR_EXPIRED_CODE' });
    }
    await this.prisma.$transaction(async (tx) => {
      const claim = await tx.verificationChallenge.updateMany({
        where: {
          id: ch.id,
          consumedAt: null,
          attempts: { lt: ch.maxAttempts },
          expiresAt: { gt: new Date() },
        },
        data: { consumedAt: new Date(), attempts: { increment: 1 } },
      });
      if (claim.count !== 1) throw new BadRequestException({ code: 'INVALID_OR_EXPIRED_CODE' });
      if (await tx.user.findFirst({ where: { phoneE164: phone, id: { not: auth.userId } } }))
        throw new BadRequestException({ code: 'PHONE_UNAVAILABLE' });
      const before = await tx.user.findUniqueOrThrow({ where: { id: auth.userId } });
      await tx.user.update({
        where: { id: auth.userId },
        data: { phoneE164: phone, phoneVerifiedAt: new Date() },
      });
      await tx.verificationChallenge.updateMany({
        where: { userId: auth.userId, purpose: 'PHONE_VERIFICATION', consumedAt: null },
        data: { consumedAt: new Date() },
      });
      await this.startSensitiveHold(tx, auth.userId, req);
      const sessions = await tx.session.findMany({ where: { userId: auth.userId } });
      await this.revokeSessions(tx, {
        userId: auth.userId,
        sessions,
        reason: 'PHONE_CHANGED',
        eventType: before.phoneE164 ? 'PHONE_CHANGED' : 'PHONE_VERIFIED',
        req,
        sessionId: auth.sessionId,
        deviceId: auth.deviceId,
      });
    });
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.userId } });
    this.mailer.send(user.email, 'PHONE_CHANGED_NOTICE');
    this.clearAuth(res);
    return { message: 'Telefone confirmado. Faça login novamente.' };
  }

  private async createEmailChallenge(
    tx: Prisma.TransactionClient,
    userId: string,
    purpose: 'EMAIL_CHANGE_CURRENT' | 'EMAIL_CHANGE_NEW',
    contextId: string,
    emailHash: string,
    expiresAt: Date,
  ): Promise<string> {
    const secret = randomToken();
    const row = await tx.verificationChallenge.create({
      data: {
        userId,
        purpose,
        contextId,
        targetHash: emailHash,
        tokenHash: 'pending',
        maxAttempts: this.authConfig().maxAttempts,
        expiresAt,
      },
    });
    await tx.verificationChallenge.update({
      where: { id: row.id },
      data: {
        tokenHash: challengeSecretHash(row.id, secret, this.authConfig().verificationPepper),
      },
    });
    return buildChallengeToken(row.id, secret);
  }

  async requestEmailChange(
    dto: EmailChangeRequestDto,
    auth: { userId: string; sessionId: string; deviceId: string },
    req: Request,
  ): Promise<{ message: string; requestId: string; expiresAt: Date }> {
    const newEmail = normalizeEmail(dto.newEmail);
    await this.rate(['email-change-request', req.ip ?? 'unknown', auth.userId, newEmail], 5, 300);
    await this.assertCurrentPassword(auth.userId, dto.currentPassword);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.userId } });
    if (newEmail === user.email) throw new BadRequestException({ code: 'EMAIL_UNCHANGED' });
    if (await this.prisma.user.findUnique({ where: { email: newEmail } }))
      throw new BadRequestException({ code: 'EMAIL_UNAVAILABLE' });
    const expiresAt = new Date(Date.now() + this.authConfig().emailChangeTtlMinutes * 60_000);
    const emailHash = targetHash('email', newEmail, this.authConfig().verificationPepper);
    let requestId = '';
    let currentToken = '';
    let newToken = '';
    await this.prisma.$transaction(async (tx) => {
      await tx.emailChangeRequest.updateMany({
        where: { userId: auth.userId, completedAt: null, cancelledAt: null },
        data: { cancelledAt: new Date() },
      });
      const change = await tx.emailChangeRequest.create({
        data: { userId: auth.userId, newEmailHash: emailHash, expiresAt },
      });
      requestId = change.id;
      currentToken = await this.createEmailChallenge(
        tx,
        auth.userId,
        'EMAIL_CHANGE_CURRENT',
        change.id,
        emailHash,
        expiresAt,
      );
      newToken = await this.createEmailChallenge(
        tx,
        auth.userId,
        'EMAIL_CHANGE_NEW',
        change.id,
        emailHash,
        expiresAt,
      );
      await this.persistCriticalSecurityEvent(
        {
          userId: auth.userId,
          sessionId: auth.sessionId,
          deviceId: auth.deviceId,
          eventType: 'EMAIL_CHANGE_REQUESTED',
          outcome: 'PENDING',
          req,
        },
        tx,
      );
    });
    this.mailer.send(user.email, 'EMAIL_CHANGE_CONFIRM_CURRENT', currentToken);
    this.mailer.send(newEmail, 'EMAIL_CHANGE_CONFIRM_NEW', newToken);
    return { message: 'Enviamos confirmações para os dois e-mails.', requestId, expiresAt };
  }

  async confirmEmailChange(
    dto: EmailChangeConfirmDto,
    req: Request,
    res: Response,
  ): Promise<{ status: 'PENDING' | 'COMPLETED'; message: string }> {
    const newEmail = normalizeEmail(dto.newEmail);
    await this.rate(['email-change-confirm', req.ip ?? 'unknown', newEmail], 20, 300);
    const parts = splitChallengeToken(dto.token);
    if (!parts) throw new BadRequestException({ code: 'INVALID_OR_EXPIRED_TOKEN' });
    const emailHash = targetHash('email', newEmail, this.authConfig().verificationPepper);
    const ch = await this.prisma.verificationChallenge.findUnique({
      where: { id: parts.challengeId },
    });
    if (
      !ch ||
      (ch.purpose !== 'EMAIL_CHANGE_CURRENT' && ch.purpose !== 'EMAIL_CHANGE_NEW') ||
      ch.targetHash !== emailHash ||
      !ch.contextId ||
      ch.consumedAt ||
      ch.expiresAt < new Date()
    )
      throw new BadRequestException({ code: 'INVALID_OR_EXPIRED_TOKEN' });
    if (
      !safeEqual(
        challengeSecretHash(ch.id, parts.secret, this.authConfig().verificationPepper),
        ch.tokenHash,
      )
    ) {
      await this.prisma.verificationChallenge.update({
        where: { id: ch.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException({ code: 'INVALID_OR_EXPIRED_TOKEN' });
    }
    const result = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.verificationChallenge.updateMany({
        where: { id: ch.id, consumedAt: null },
        data: { consumedAt: new Date(), attempts: { increment: 1 } },
      });
      if (claim.count !== 1) throw new BadRequestException({ code: 'INVALID_OR_EXPIRED_TOKEN' });
      const change = await tx.emailChangeRequest.findUnique({ where: { id: ch.contextId! } });
      if (
        !change ||
        change.cancelledAt ||
        change.completedAt ||
        change.expiresAt < new Date() ||
        change.newEmailHash !== emailHash
      )
        throw new BadRequestException({ code: 'INVALID_OR_EXPIRED_TOKEN' });
      const field =
        ch.purpose === 'EMAIL_CHANGE_CURRENT' ? 'currentEmailConfirmedAt' : 'newEmailConfirmedAt';
      const updated = await tx.emailChangeRequest.update({
        where: { id: change.id },
        data: { [field]: new Date() },
      });
      await this.persistCriticalSecurityEvent(
        {
          userId: ch.userId,
          eventType:
            ch.purpose === 'EMAIL_CHANGE_CURRENT'
              ? 'EMAIL_CHANGE_CURRENT_CONFIRMED'
              : 'EMAIL_CHANGE_NEW_CONFIRMED',
          req,
        },
        tx,
      );
      if (!updated.currentEmailConfirmedAt || !updated.newEmailConfirmedAt)
        return { status: 'PENDING' as const, oldEmail: null };
      const finalClaim = await tx.emailChangeRequest.updateMany({
        where: { id: change.id, completedAt: null, cancelledAt: null },
        data: { completedAt: new Date() },
      });
      if (finalClaim.count !== 1) return { status: 'COMPLETED' as const, oldEmail: null };
      if (await tx.user.findUnique({ where: { email: newEmail } }))
        throw new BadRequestException({ code: 'EMAIL_UNAVAILABLE' });
      const user = await tx.user.findUniqueOrThrow({ where: { id: ch.userId } });
      await tx.user.update({
        where: { id: ch.userId },
        data: { email: newEmail, emailVerifiedAt: new Date(), status: 'ACTIVE' },
      });
      await tx.verificationChallenge.updateMany({
        where: { contextId: change.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      await this.startSensitiveHold(tx, ch.userId, req);
      const sessions = await tx.session.findMany({ where: { userId: ch.userId } });
      await this.revokeSessions(tx, {
        userId: ch.userId,
        sessions,
        reason: 'EMAIL_CHANGED',
        eventType: 'EMAIL_CHANGED',
        req,
      });
      return { status: 'COMPLETED' as const, oldEmail: user.email };
    });
    if (result.status === 'COMPLETED') {
      if (result.oldEmail) this.mailer.send(result.oldEmail, 'EMAIL_CHANGED_NOTICE');
      this.mailer.send(newEmail, 'EMAIL_CHANGED_NOTICE');
      this.clearAuth(res);
      return { status: 'COMPLETED', message: 'E-mail alterado. Faça login novamente.' };
    }
    return { status: 'PENDING', message: 'Confirmação registrada. Aguarde a outra confirmação.' };
  }

  async me(userId: string): Promise<Record<string, unknown>> {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return {
      id: u.id,
      email: u.email,
      emailVerified: !!u.emailVerifiedAt,
      phoneVerified: !!u.phoneVerifiedAt,
      phoneMasked: maskBrazilianPhone(u.phoneE164),
      sensitiveActionHoldUntil: u.sensitiveActionHoldUntil,
      sensitiveActionHoldActive:
        !!u.sensitiveActionHoldUntil && u.sensitiveActionHoldUntil > new Date(),
      birthDate: u.birthDate,
      status: u.status,
      createdAt: u.createdAt,
    };
  }
}
