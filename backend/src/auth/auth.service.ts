import crypto from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
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
import { EmailDto, LoginDto, RegisterDto, TokenDto } from './dto';
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
  splitChallengeToken,
  validatePasswordPolicy,
  verifyPassword,
} from './auth.utils';

export interface AuthEmailPort {
  send(to: string, purpose: 'EMAIL_VERIFICATION' | 'DEVICE_APPROVAL', token: string): void;
}

@Injectable()
export class AuthMailer implements AuthEmailPort, OnModuleInit {
  readonly sent: {
    to: string;
    purpose: 'EMAIL_VERIFICATION' | 'DEVICE_APPROVAL';
    token: string;
  }[] = [];

  onModuleInit(): void {
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.AUTH_EMAIL_DELIVERY_MODE !== 'disabled'
    ) {
      throw new ServiceUnavailableException('Auth email provider unavailable');
    }
  }

  send(to: string, purpose: 'EMAIL_VERIFICATION' | 'DEVICE_APPROVAL', token: string): void {
    if (process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException('Auth email provider unavailable');
    }
    if (process.env.AUTH_EMAIL_DELIVERY_MODE === 'memory') {
      this.sent.push({ to, purpose, token });
    }
  }
}

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

  private async event(input: EventInput, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    try {
      await client.securityEvent.create({
        data: {
          userId: input.userId ?? undefined,
          sessionId: input.sessionId ?? undefined,
          deviceId: input.deviceId ?? undefined,
          eventType: input.eventType,
          outcome: input.outcome ?? 'SUCCESS',
          metadata: sanitizeMetadata(input.metadata) as Prisma.InputJsonValue,
          ipHash: input.req ? this.ipHash(input.req) : undefined,
          userAgent: sanitizeUserAgent(input.req?.headers['user-agent']),
        },
      });
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
    purpose: 'EMAIL_VERIFICATION' | 'DEVICE_APPROVAL',
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
    purpose: 'EMAIL_VERIFICATION' | 'DEVICE_APPROVAL',
  ): Promise<{ id: string; userId: string; deviceId: string | null }> {
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
    return { id: challenge.id, userId: challenge.userId, deviceId: challenge.deviceId };
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
      await this.event({ userId: user.id, eventType: 'REGISTERED', req });
      await this.event({ userId: user.id, eventType: 'EMAIL_VERIFICATION_REQUESTED', req });
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
      await this.event({ userId: challenge.userId, eventType: 'EMAIL_VERIFIED', req }, tx);
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
        this.authConfig().emailVerificationTtlMinutes,
      );
      this.mailer.send(email, 'EMAIL_VERIFICATION', token);
      await this.event({ userId: user.id, eventType: 'EMAIL_VERIFICATION_REQUESTED', req });
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
      await this.event({
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
    if (!user || !user.passwordCredential) return this.loginFailure(null, req);
    if (user.passwordCredential.lockedUntil && user.passwordCredential.lockedUntil > new Date()) {
      await this.event({ userId: user.id, eventType: 'LOGIN_LOCKED', outcome: 'BLOCKED', req });
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });
    }
    if (!(await verifyPassword(user.passwordCredential.passwordHash, dto.password)))
      return this.loginFailure(user, req);
    if (user.status !== 'ACTIVE' || !user.emailVerifiedAt)
      throw new ForbiddenException({ code: 'EMAIL_NOT_VERIFIED' });
    const device = await this.resolveLoginDevice(user, dto, req, res);
    if (device.status !== 'APPROVED') {
      const token = await this.challenge(
        user.id,
        'DEVICE_APPROVAL',
        this.authConfig().deviceApprovalTtlMinutes,
        device.id,
      );
      this.mailer.send(user.email, 'DEVICE_APPROVAL', token);
      await this.event({
        userId: user.id,
        deviceId: device.id,
        eventType: 'DEVICE_APPROVAL_REQUIRED',
        outcome: 'PENDING',
        req,
      });
      await this.event({
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
    await this.event({ userId: user.id, deviceId: device.id, eventType: 'LOGIN_SUCCEEDED', req });
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
      await this.event(
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
      await this.event(
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
        await this.event({
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
      await this.event(
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
      await this.event(
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
    await this.prisma.$transaction(async (tx) => {
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
        data: { usedAt: new Date(), replacedByTokenId: next.id },
      });
      await tx.session.update({
        where: { id: sess.id },
        data: {
          refreshTokenHash: newHash,
          csrfTokenHash: hmacToken(newCsrf, c.csrfPepper),
          lastUsedAt: new Date(),
        },
      });
      await this.event(
        {
          userId: sess.userId,
          sessionId: sess.id,
          deviceId: sess.deviceId,
          eventType: 'SESSION_REFRESHED',
          req,
        },
        tx,
      );
    });
    this.setRefreshAndCsrfCookies(res, refresh, newCsrf);
    return {
      accessToken: await this.jwt.signAsync(
        { sub: sess.userId, sid: sess.id, type: 'access' },
        { secret: c.accessSecret, expiresIn: c.accessTtlSeconds },
      ),
    };
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
        await this.event(
          {
            userId: session.userId,
            sessionId: session.id,
            deviceId: session.deviceId,
            eventType: 'LOGOUT',
            req,
          },
          tx,
        );
        await this.event(
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

  async me(userId: string): Promise<Record<string, unknown>> {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return {
      id: u.id,
      email: u.email,
      emailVerified: !!u.emailVerifiedAt,
      phoneVerified: !!u.phoneVerifiedAt,
      birthDate: u.birthDate,
      status: u.status,
      createdAt: u.createdAt,
    };
  }
}
