/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unnecessary-type-assertion, no-control-regex */
import { ConflictException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PlatformRole,
  Prisma,
  SecurityEventOutcome,
  SecurityEventType,
  SellerApplicationStatus,
  UserStatus,
} from '@prisma/client';
import { AppError } from '../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';
import {
  grantPlatformRoleInTransaction,
  serializableTransactionWithRetry,
} from '../auth/platform-role-operations';
import { RejectSellerApplicationDto, UpsertSellerApplicationDto } from './dto';
import {
  assertTransition,
  requirementsFor,
  toPublicStatus,
  validateSellerDescription,
  validateSellerSlug,
  validateStoreName,
} from './seller-onboarding.utils';

@Injectable()
export class SellerOnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}
  private version() {
    return (
      this.config.get<string>('CURRENT_SELLER_AGREEMENT_VERSION') ??
      process.env.CURRENT_SELLER_AGREEMENT_VERSION ??
      'test-seller-agreement'
    );
  }
  private appError(code: string, status = HttpStatus.BAD_REQUEST) {
    return new AppError(code, code, status);
  }
  private mapApp(a: any) {
    return (
      a && {
        id: a.id,
        storeName: a.storeName,
        requestedSlug: a.requestedSlug,
        description: a.description,
        status: toPublicStatus(a.status),
        submittedAt: a.submittedAt?.toISOString?.() ?? a.submittedAt ?? null,
        rejectionCode: a.rejectionCode,
        rejectionReason: a.rejectionReason,
      }
    );
  }
  private mapProfile(p: any) {
    return (
      p && {
        id: p.id,
        storeName: p.storeName,
        slug: p.slug,
        description: p.description,
        status: String(p.status).toLowerCase(),
        verified: p.verified,
      }
    );
  }
  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { sellerApplication: true, sellerProfile: true },
    });
    return {
      application: this.mapApp(user.sellerApplication),
      sellerProfile: this.mapProfile(user.sellerProfile),
      requirements: requirementsFor(user, this.version()),
    };
  }
  private validateDto(dto: UpsertSellerApplicationDto) {
    const storeName = validateStoreName(dto.storeName);
    if (!storeName) throw this.appError('SELLER_STORE_NAME_INVALID');
    const requestedSlug = validateSellerSlug(dto.requestedSlug);
    if (!requestedSlug) throw this.appError('SELLER_SLUG_INVALID');
    const description = validateSellerDescription(dto.description);
    if (description === undefined) throw this.appError('SELLER_DESCRIPTION_INVALID');
    if (!dto.sellerAgreementAccepted) throw this.appError('SELLER_AGREEMENT_REQUIRED');
    return { storeName, requestedSlug, description };
  }
  async saveDraft(userId: string, dto: UpsertSellerApplicationDto) {
    const data = this.validateDto(dto);
    const version = this.version();
    return serializableTransactionWithRetry(this.prisma, async (tx) => {
      const existing = await tx.sellerApplication.findUnique({ where: { userId } });
      if (existing && !['DRAFT', 'REJECTED'].includes(existing.status))
        throw this.appError('SELLER_APPLICATION_NOT_EDITABLE', HttpStatus.CONFLICT);
      const previousStatus = existing?.status ?? null;
      const app = await tx.sellerApplication.upsert({
        where: { userId },
        create: {
          userId,
          ...data,
          sellerAgreementVersion: version,
          sellerAgreementAcceptedAt: new Date(),
          status: 'DRAFT',
        },
        update: {
          ...data,
          sellerAgreementVersion: version,
          sellerAgreementAcceptedAt: new Date(),
          status: 'DRAFT',
          reviewedAt: null,
          reviewedByUserId: null,
          rejectionCode: null,
          rejectionReason: null,
        },
      });
      await tx.securityEvent.create({
        data: {
          userId,
          eventType: SecurityEventType.SELLER_APPLICATION_DRAFT_SAVED,
          outcome: SecurityEventOutcome.SUCCESS,
          metadata: {
            applicationId: app.id,
            previousStatus,
            newStatus: app.status,
            origin: 'user',
          },
        },
      });
      return this.mapApp(app);
    });
  }
  private async assertRequirements(tx: any, userId: string) {
    const user = await tx.user.findUnique({
      where: { id: userId },
      include: { roleAssignments: true },
    });
    if (!user || user.status !== UserStatus.ACTIVE)
      throw this.appError('SELLER_REQUIREMENTS_NOT_MET', HttpStatus.FORBIDDEN);
    if (!user.roleAssignments.some((r: any) => r.role === PlatformRole.BUYER))
      throw this.appError('SELLER_REQUIREMENTS_NOT_MET', HttpStatus.FORBIDDEN);
    if (!user.emailVerifiedAt)
      throw this.appError('SELLER_EMAIL_NOT_VERIFIED', HttpStatus.FORBIDDEN);
    if (!user.phoneVerifiedAt)
      throw this.appError('SELLER_PHONE_NOT_VERIFIED', HttpStatus.FORBIDDEN);
    if (!requirementsFor(user, this.version()).ageEligible)
      throw this.appError('SELLER_AGE_REQUIREMENT_NOT_MET', HttpStatus.FORBIDDEN);
  }
  async submit(userId: string) {
    return serializableTransactionWithRetry(this.prisma, async (tx) => {
      await this.assertRequirements(tx, userId);
      const app = await tx.sellerApplication.findUnique({ where: { userId } });
      if (!app) throw this.appError('SELLER_APPLICATION_NOT_FOUND', HttpStatus.NOT_FOUND);
      if (app.status === 'SUBMITTED') return this.mapApp(app);
      if (app.status !== 'DRAFT')
        throw this.appError('SELLER_APPLICATION_INVALID_TRANSITION', HttpStatus.CONFLICT);
      if (!app.sellerAgreementVersion || !app.sellerAgreementAcceptedAt)
        throw this.appError('SELLER_AGREEMENT_REQUIRED');
      const slug = validateSellerSlug(app.requestedSlug);
      if (!slug) throw this.appError('SELLER_SLUG_INVALID');
      const profile = await tx.sellerProfile.findUnique({ where: { slug } });
      if (profile) throw this.appError('SELLER_SLUG_UNAVAILABLE', HttpStatus.CONFLICT);
      const updated = await tx.sellerApplication.update({
        where: { id: app.id },
        data: { status: 'SUBMITTED', submittedAt: new Date() },
      });
      await tx.securityEvent.create({
        data: {
          userId,
          eventType: SecurityEventType.SELLER_APPLICATION_SUBMITTED,
          outcome: SecurityEventOutcome.SUCCESS,
          metadata: {
            applicationId: app.id,
            previousStatus: app.status,
            newStatus: updated.status,
            origin: 'user',
          },
        },
      });
      return this.mapApp(updated);
    });
  }
  async slugAvailability(slugRaw: string) {
    const slug = validateSellerSlug(slugRaw);
    if (!slug) throw this.appError('SELLER_SLUG_INVALID');
    const profile = await this.prisma.sellerProfile.findUnique({ where: { slug } });
    return { slug, available: !profile };
  }
  async listAdmin(status?: string, search?: string) {
    const where: Prisma.SellerApplicationWhereInput = {};
    if (status) where.status = status.toUpperCase() as SellerApplicationStatus;
    if (search)
      where.OR = [
        { storeName: { contains: search, mode: 'insensitive' } },
        { requestedSlug: { contains: search, mode: 'insensitive' } },
      ];
    const items = await this.prisma.sellerApplication.findMany({
      where,
      orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
      take: 50,
      include: {
        user: {
          select: { emailVerifiedAt: true, phoneVerifiedAt: true, birthDate: true, status: true },
        },
      },
    });
    return {
      items: items.map((a) => ({
        ...this.mapApp(a),
        requirements: requirementsFor(a.user as any, this.version()),
      })),
    };
  }
  async getAdmin(id: string) {
    const app = await this.prisma.sellerApplication.findUnique({
      where: { id },
      include: {
        user: {
          select: { emailVerifiedAt: true, phoneVerifiedAt: true, birthDate: true, status: true },
        },
      },
    });
    if (!app) throw new NotFoundException({ code: 'SELLER_APPLICATION_NOT_FOUND' });
    return { ...this.mapApp(app), requirements: requirementsFor(app.user as any, this.version()) };
  }
  async startReview(id: string, adminUserId: string) {
    return serializableTransactionWithRetry(this.prisma, async (tx) => {
      const app = await tx.sellerApplication.findUnique({ where: { id } });
      if (!app) throw new NotFoundException({ code: 'SELLER_APPLICATION_NOT_FOUND' });
      if (app.status === 'UNDER_REVIEW') return this.mapApp(app);
      if (!assertTransition(app.status, 'UNDER_REVIEW'))
        throw this.appError('SELLER_APPLICATION_INVALID_TRANSITION', HttpStatus.CONFLICT);
      const updated = await tx.sellerApplication.update({
        where: { id },
        data: { status: 'UNDER_REVIEW' },
      });
      await tx.securityEvent.create({
        data: {
          userId: app.userId,
          eventType: SecurityEventType.SELLER_APPLICATION_REVIEW_STARTED,
          outcome: SecurityEventOutcome.SUCCESS,
          metadata: {
            applicationId: id,
            previousStatus: app.status,
            newStatus: updated.status,
            reviewer: adminUserId,
            origin: 'admin',
          },
        },
      });
      return this.mapApp(updated);
    });
  }
  async reject(id: string, adminUserId: string, dto: RejectSellerApplicationDto) {
    if (dto.reason && /[<>]|[\u0000-\u001F\u007F]/.test(dto.reason))
      throw this.appError('SELLER_REJECTION_REASON_INVALID');
    return serializableTransactionWithRetry(this.prisma, async (tx) => {
      const app = await tx.sellerApplication.findUnique({ where: { id } });
      if (!app) throw new NotFoundException({ code: 'SELLER_APPLICATION_NOT_FOUND' });
      if (!['SUBMITTED', 'UNDER_REVIEW'].includes(app.status))
        throw this.appError('SELLER_APPLICATION_INVALID_TRANSITION', HttpStatus.CONFLICT);
      const updated = await tx.sellerApplication.update({
        where: { id },
        data: {
          status: 'REJECTED',
          reviewedAt: new Date(),
          reviewedByUserId: adminUserId,
          rejectionCode: dto.code,
          rejectionReason: dto.reason ?? null,
        },
      });
      await tx.securityEvent.create({
        data: {
          userId: app.userId,
          eventType: SecurityEventType.SELLER_APPLICATION_REJECTED,
          outcome: SecurityEventOutcome.SUCCESS,
          metadata: {
            applicationId: id,
            previousStatus: app.status,
            newStatus: updated.status,
            code: dto.code,
            origin: 'admin',
          },
        },
      });
      return this.mapApp(updated);
    });
  }
  async approve(id: string, adminUserId: string) {
    try {
      return await serializableTransactionWithRetry(this.prisma, async (tx) => {
        const app = await tx.sellerApplication.findUnique({ where: { id } });
        if (!app) throw new NotFoundException({ code: 'SELLER_APPLICATION_NOT_FOUND' });
        if (app.status === 'APPROVED') return this.mapApp(app);
        if (!['SUBMITTED', 'UNDER_REVIEW'].includes(app.status))
          throw this.appError('SELLER_APPLICATION_INVALID_TRANSITION', HttpStatus.CONFLICT);
        await this.assertRequirements(tx, app.userId);
        const slug = validateSellerSlug(app.requestedSlug);
        if (!slug) throw this.appError('SELLER_SLUG_INVALID');
        const existing = await tx.sellerProfile.findUnique({ where: { slug } });
        if (existing && existing.userId !== app.userId)
          throw this.appError('SELLER_SLUG_UNAVAILABLE', HttpStatus.CONFLICT);
        await tx.sellerProfile.create({
          data: {
            userId: app.userId,
            storeName: app.storeName,
            slug,
            description: app.description,
            verified: false,
          },
        });
        await grantPlatformRoleInTransaction(tx, app.userId, PlatformRole.SELLER, 'system');
        const updated = await tx.sellerApplication.update({
          where: { id },
          data: { status: 'APPROVED', reviewedAt: new Date(), reviewedByUserId: adminUserId },
        });
        await tx.securityEvent.create({
          data: {
            userId: app.userId,
            eventType: SecurityEventType.SELLER_PROFILE_CREATED,
            outcome: SecurityEventOutcome.SUCCESS,
            metadata: { applicationId: id, slug, origin: 'admin' },
          },
        });
        await tx.securityEvent.create({
          data: {
            userId: app.userId,
            eventType: SecurityEventType.SELLER_APPLICATION_APPROVED,
            outcome: SecurityEventOutcome.SUCCESS,
            metadata: {
              applicationId: id,
              previousStatus: app.status,
              newStatus: updated.status,
              slug,
              origin: 'admin',
            },
          },
        });
        return this.mapApp(updated);
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
        throw new ConflictException({ code: 'SELLER_APPROVAL_CONFLICT' });
      throw e;
    }
  }
}
