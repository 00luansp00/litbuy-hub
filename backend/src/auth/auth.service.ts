/* eslint-disable */
import crypto from 'node:crypto';
import {
  HttpException,
  HttpStatus,
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Response, Request } from 'express';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  hmacToken,
  hashPassword,
  isAtLeast18,
  normalizeEmail,
  parseBirthDate,
  randomToken,
  sanitizeMetadata,
  sanitizeUserAgent,
  validatePasswordPolicy,
  verifyPassword,
} from './auth.utils';
import { EmailDto, LoginDto, RegisterDto, TokenDto } from './dto';

@Injectable()
export class AuthMailer {
  sent: { to: string; purpose: string; token: string }[] = [];
  send(to: string, purpose: string, token: string) {
    if (process.env.NODE_ENV === 'production' && process.env.AUTH_EMAIL_DELIVERY_MODE === 'console')
      throw new Error('Auth email provider unavailable');
    if (process.env.AUTH_EMAIL_DELIVERY_MODE !== 'console') this.sent.push({ to, purpose, token });
  }
}
@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private redis: RedisService,
    private mailer: AuthMailer,
  ) {}
  private c() {
    return this.config.getOrThrow<any>('auth');
  }
  private cookieBase() {
    const c = this.c();
    return {
      httpOnly: true,
      secure: c.cookieSecure,
      sameSite: c.cookieSameSite,
      domain: c.cookieDomain,
      path: '/api/v1/auth' as const,
    };
  }
  private setDevice(res: Response, token: string) {
    const c = this.c();
    res.cookie(c.deviceCookieName, token, { ...this.cookieBase(), maxAge: 400 * 24 * 3600_000 });
  }
  private clearAuth(res: Response) {
    const c = this.c();
    res.clearCookie(c.refreshCookieName, { path: '/api/v1/auth' });
    res.clearCookie(c.csrfCookieName, { path: '/api/v1/auth' });
  }
  private async event(data: any) {
    await this.prisma.securityEvent
      .create({
        data: {
          ...data,
          metadata: sanitizeMetadata(data.metadata),
          userAgent: sanitizeUserAgent(data.userAgent),
          outcome: data.outcome ?? 'SUCCESS',
        },
      })
      .catch(() => undefined);
  }
  private async rate(key: string, limit = 20, ttl = 60) {
    try {
      const r = await this.redis.getClient();
      const n = await r.incr(`rl:${key}`);
      if (n === 1) await r.expire(`rl:${key}`, ttl);
      if (n > limit) throw new BadRequestException({ code: 'RATE_LIMITED' });
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
    }
  }
  private async challenge(
    userId: string,
    purpose: 'EMAIL_VERIFICATION' | 'DEVICE_APPROVAL',
    minutes: number,
    deviceId?: string,
  ) {
    const c = this.c();
    const token = randomToken();
    const tokenHash = hmacToken(token, c.verificationPepper);
    await this.prisma.verificationChallenge.updateMany({
      where: { userId, purpose, deviceId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await this.prisma.verificationChallenge.create({
      data: {
        userId,
        deviceId,
        purpose,
        tokenHash,
        maxAttempts: c.maxAttempts,
        expiresAt: new Date(Date.now() + minutes * 60_000),
      },
    });
    return token;
  }
  async register(dto: RegisterDto, req: Request, res: Response) {
    await this.rate(`register:${req.ip}`, 10, 300);
    const c = this.c();
    const email = normalizeEmail(dto.email);
    if (
      !dto.termsAccepted ||
      !dto.privacyAccepted ||
      !isAtLeast18(dto.birthDate) ||
      !validatePasswordPolicy(dto.password)
    )
      throw new BadRequestException({ code: 'INVALID_REGISTRATION' });
    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      const deviceToken = randomToken();
      const tokenHash = hmacToken(deviceToken, c.devicePepper);
      user = await this.prisma.user.create({
        data: {
          email,
          birthDate: parseBirthDate(dto.birthDate)!,
          termsVersion: dto.termsVersion,
          termsAcceptedAt: new Date(),
          privacyVersion: dto.privacyVersion,
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
        include: { devices: true },
      });
      this.setDevice(res, deviceToken);
      const token = await this.challenge(
        user.id,
        'EMAIL_VERIFICATION',
        c.emailVerificationTtlMinutes,
      );
      this.mailer.send(email, 'EMAIL_VERIFICATION', token);
      await this.event({
        userId: user.id,
        eventType: 'REGISTERED',
        metadata: { emailHash: hmacToken(email, c.ipPepper) },
      });
      await this.event({ userId: user.id, eventType: 'EMAIL_VERIFICATION_REQUESTED' });
    }
    return { message: 'Se os dados forem válidos, enviaremos as instruções por e-mail.' };
  }
  async verifyEmail(dto: TokenDto, req: Request) {
    await this.rate(`email-verify:${req.ip}`, 20, 300);
    const c = this.c();
    const tokenHash = hmacToken(dto.token, c.verificationPepper);
    const ch = await this.prisma.verificationChallenge.findUnique({ where: { tokenHash } });
    if (
      !ch ||
      ch.purpose !== 'EMAIL_VERIFICATION' ||
      ch.consumedAt ||
      ch.expiresAt < new Date() ||
      ch.attempts >= ch.maxAttempts
    )
      throw new BadRequestException({ code: 'INVALID_OR_EXPIRED_TOKEN' });
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: ch.userId },
        data: { emailVerifiedAt: new Date(), status: 'ACTIVE' },
      }),
      this.prisma.verificationChallenge.update({
        where: { id: ch.id },
        data: { consumedAt: new Date(), attempts: { increment: 1 } },
      }),
    ]);
    await this.event({ userId: ch.userId, eventType: 'EMAIL_VERIFIED' });
    return { message: 'E-mail confirmado.' };
  }
  async resendEmail(dto: EmailDto, req: Request) {
    await this.rate(`email-resend:${req.ip}:${normalizeEmail(dto.email)}`, 5, 300);
    const email = normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && !user.emailVerifiedAt) {
      const token = await this.challenge(
        user.id,
        'EMAIL_VERIFICATION',
        this.c().emailVerificationTtlMinutes,
      );
      this.mailer.send(email, 'EMAIL_VERIFICATION', token);
      await this.event({ userId: user.id, eventType: 'EMAIL_VERIFICATION_REQUESTED' });
    }
    return { message: 'Se a conta existir, enviaremos as instruções por e-mail.' };
  }
  async login(dto: LoginDto, req: Request, res: Response) {
    const c = this.c();
    const email = normalizeEmail(dto.email);
    await this.rate(`login:${req.ip}:${email}`, 10, 300);
    const fail = async (user?: any) => {
      if (user?.passwordCredential) {
        const attempts = user.passwordCredential.failedLoginAttempts + 1;
        await this.prisma.passwordCredential.update({
          where: { userId: user.id },
          data: {
            failedLoginAttempts: attempts,
            lockedUntil:
              attempts >= c.maxAttempts
                ? new Date(Date.now() + c.loginLockMinutes * 60_000)
                : undefined,
          },
        });
        await this.event({
          userId: user.id,
          eventType: attempts >= c.maxAttempts ? 'LOGIN_LOCKED' : 'LOGIN_FAILED',
          outcome: 'FAILURE',
        });
      }
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });
    };
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { passwordCredential: true },
    });
    if (!user || !user.passwordCredential) return fail();
    if (user.passwordCredential.lockedUntil && user.passwordCredential.lockedUntil > new Date())
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });
    if (!(await verifyPassword(user.passwordCredential.passwordHash, dto.password)))
      return fail(user);
    if (user.status !== 'ACTIVE' || !user.emailVerifiedAt)
      throw new ForbiddenException({ code: 'EMAIL_NOT_VERIFIED' });
    const rawDevice = req.cookies?.[c.deviceCookieName] || randomToken();
    const tokenHash = hmacToken(rawDevice, c.devicePepper);
    let device = await this.prisma.device.findUnique({ where: { tokenHash } });
    if (!device || device.userId !== user.id || device.status !== 'APPROVED') {
      device = await this.prisma.device.upsert({
        where: { tokenHash },
        update: {
          userId: user.id,
          displayName: dto.deviceName,
          status: 'PENDING',
          lastSeenAt: new Date(),
        },
        create: {
          userId: user.id,
          tokenHash,
          displayName: dto.deviceName,
          userAgent: sanitizeUserAgent(req.headers['user-agent']),
          status: 'PENDING',
        },
      });
      this.setDevice(res, rawDevice);
      const token = await this.challenge(
        user.id,
        'DEVICE_APPROVAL',
        c.deviceApprovalTtlMinutes,
        device.id,
      );
      this.mailer.send(user.email, 'DEVICE_APPROVAL', token);
      await this.event({
        userId: user.id,
        deviceId: device.id,
        eventType: 'DEVICE_APPROVAL_REQUIRED',
        outcome: 'PENDING',
      });
      throw new HttpException({ code: 'DEVICE_APPROVAL_REQUIRED' }, HttpStatus.ACCEPTED);
    }
    await this.prisma.passwordCredential.update({
      where: { userId: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
    return this.createSession(user, device, res);
  }
  private async createSession(user: any, device: any, res: Response) {
    const c = this.c();
    const refresh = randomToken();
    const csrf = randomToken();
    const sess = await this.prisma.session.create({
      data: {
        userId: user.id,
        deviceId: device.id,
        refreshTokenHash: hmacToken(refresh, c.refreshPepper),
        refreshTokenFamilyId: crypto.randomUUID(),
        csrfTokenHash: hmacToken(csrf, c.csrfPepper),
        expiresAt: new Date(Date.now() + c.refreshTtlDays * 86400_000),
      },
    });
    res.cookie(c.refreshCookieName, refresh, {
      ...this.cookieBase(),
      maxAge: c.refreshTtlDays * 86400_000,
    });
    res.cookie(c.csrfCookieName, csrf, {
      ...this.cookieBase(),
      httpOnly: false,
      maxAge: c.refreshTtlDays * 86400_000,
    });
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, sid: sess.id, type: 'access' },
      { secret: c.accessSecret, expiresIn: c.accessTtlSeconds },
    );
    await this.event({
      userId: user.id,
      sessionId: sess.id,
      deviceId: device.id,
      eventType: 'SESSION_CREATED',
    });
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
  async approveDevice(dto: TokenDto, req: Request) {
    await this.rate(`device-approve:${req.ip}`, 20, 300);
    const c = this.c();
    const ch = await this.prisma.verificationChallenge.findUnique({
      where: { tokenHash: hmacToken(dto.token, c.verificationPepper) },
    });
    if (
      !ch ||
      ch.purpose !== 'DEVICE_APPROVAL' ||
      !ch.deviceId ||
      ch.consumedAt ||
      ch.expiresAt < new Date() ||
      ch.attempts >= ch.maxAttempts
    )
      throw new BadRequestException({ code: 'INVALID_OR_EXPIRED_TOKEN' });
    await this.prisma.$transaction([
      this.prisma.device.update({
        where: { id: ch.deviceId },
        data: { status: 'APPROVED', approvedAt: new Date() },
      }),
      this.prisma.verificationChallenge.update({
        where: { id: ch.id },
        data: { consumedAt: new Date(), attempts: { increment: 1 } },
      }),
    ]);
    await this.event({ userId: ch.userId, deviceId: ch.deviceId, eventType: 'DEVICE_APPROVED' });
    return { message: 'Dispositivo aprovado. Faça login novamente.' };
  }
  async resendDevice(dto: EmailDto, req: Request) {
    await this.rate(`device-resend:${req.ip}`, 5, 300);
    const c = this.c();
    const email = normalizeEmail(dto.email);
    const raw = req.cookies?.[c.deviceCookieName];
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
        });
      }
    }
    return { message: 'Se a conta e o dispositivo existirem, enviaremos as instruções.' };
  }
  async refresh(req: Request, res: Response) {
    const c = this.c();
    await this.rate(`refresh:${req.ip}`, 60, 60);
    const raw = req.cookies?.[c.refreshCookieName];
    const csrf = req.cookies?.[c.csrfCookieName];
    if (!raw || !csrf || csrf !== req.headers['x-csrf-token'])
      throw new UnauthorizedException({ code: 'INVALID_SESSION' });
    const hash = hmacToken(raw, c.refreshPepper);
    const sess = await this.prisma.session.findUnique({
      where: { refreshTokenHash: hash },
      include: { user: true, device: true },
    });
    if (!sess) {
      await this.event({ eventType: 'REFRESH_TOKEN_REUSE_DETECTED', outcome: 'CRITICAL' });
      this.clearAuth(res);
      throw new UnauthorizedException({ code: 'INVALID_SESSION' });
    }
    if (
      sess.revokedAt ||
      sess.expiresAt < new Date() ||
      sess.device.status !== 'APPROVED' ||
      hmacToken(csrf, c.csrfPepper) !== sess.csrfTokenHash
    ) {
      this.clearAuth(res);
      throw new UnauthorizedException({ code: 'INVALID_SESSION' });
    }
    const refresh = randomToken();
    const newCsrf = randomToken();
    await this.prisma.session.update({
      where: { id: sess.id },
      data: {
        refreshTokenHash: hmacToken(refresh, c.refreshPepper),
        csrfTokenHash: hmacToken(newCsrf, c.csrfPepper),
        lastUsedAt: new Date(),
      },
    });
    res.cookie(c.refreshCookieName, refresh, {
      ...this.cookieBase(),
      maxAge: c.refreshTtlDays * 86400_000,
    });
    res.cookie(c.csrfCookieName, newCsrf, {
      ...this.cookieBase(),
      httpOnly: false,
      maxAge: c.refreshTtlDays * 86400_000,
    });
    const accessToken = await this.jwt.signAsync(
      { sub: sess.userId, sid: sess.id, type: 'access' },
      { secret: c.accessSecret, expiresIn: c.accessTtlSeconds },
    );
    await this.event({
      userId: sess.userId,
      sessionId: sess.id,
      deviceId: sess.deviceId,
      eventType: 'SESSION_REFRESHED',
    });
    return { accessToken };
  }
  async logout(req: Request, res: Response) {
    const c = this.c();
    const raw = req.cookies?.[c.refreshCookieName];
    if (raw) {
      const sess = await this.prisma.session
        .findUnique({ where: { refreshTokenHash: hmacToken(raw, c.refreshPepper) } })
        .catch(() => null);
      if (sess && !sess.revokedAt) {
        await this.prisma.session.update({
          where: { id: sess.id },
          data: { revokedAt: new Date(), revocationReason: 'LOGOUT' },
        });
        await this.event({
          userId: sess.userId,
          sessionId: sess.id,
          deviceId: sess.deviceId,
          eventType: 'LOGOUT',
        });
      }
    }
    this.clearAuth(res);
    return { message: 'Logout realizado.' };
  }
  async me(userId: string) {
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
