import { ConflictException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PlatformRole,
  Prisma,
  SecurityEventOutcome,
  SecurityEventType,
  SellerApplication,
  SellerApplicationStatus,
  SellerProfile,
  SellerProfileStatus,
  User,
  UserRoleAssignment,
  UserStatus,
} from '@prisma/client';
import { AppError } from '../common/errors/app-error';
import {
  grantPlatformRoleInTransaction,
  serializableTransactionWithRetry,
} from '../auth/platform-role-operations';
import { PrismaService } from '../database/prisma.service';
import {
  AdminSellerApplicationsQueryDto,
  RejectSellerApplicationDto,
  UpsertSellerApplicationDto,
} from './dto';
import {
  assertTransition,
  requirementsFor,
  toPublicStatus,
  validateSellerDescription,
  validateSellerSlug,
  validateStoreName,
  type SellerPublicStatus,
} from './seller-onboarding.utils';

type ApplicationPublic = {
  id: string;
  storeName: string;
  requestedSlug: string;
  description: string | null;
  status: SellerPublicStatus;
  submittedAt: string | null;
  rejectionCode: string | null;
  rejectionReason: string | null;
};
type ProfilePublic = {
  id: string;
  storeName: string;
  slug: string;
  description: string | null;
  status: 'active' | 'suspended' | 'closed';
  verified: boolean;
};
type RequirementUser = Pick<User, 'status' | 'emailVerifiedAt' | 'phoneVerifiedAt' | 'birthDate'>;
type OwnerUser = RequirementUser & { roleAssignments: Pick<UserRoleAssignment, 'role'>[] };
type ApplicationWithRequirementUser = SellerApplication & { user: RequirementUser };

const publicToDbStatus: Record<SellerPublicStatus, SellerApplicationStatus> = {
  draft: SellerApplicationStatus.DRAFT,
  submitted: SellerApplicationStatus.SUBMITTED,
  under_review: SellerApplicationStatus.UNDER_REVIEW,
  approved: SellerApplicationStatus.APPROVED,
  rejected: SellerApplicationStatus.REJECTED,
};
const profileStatusApi: Record<SellerProfileStatus, ProfilePublic['status']> = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  CLOSED: 'closed',
};

@Injectable()
export class SellerOnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private version(): string {
    return this.config.getOrThrow<string>('CURRENT_SELLER_AGREEMENT_VERSION');
  }
  private appError(code: string, status = HttpStatus.BAD_REQUEST) {
    return new AppError(code, code, status);
  }
  private mapApp(application: SellerApplication | null): ApplicationPublic | null {
    if (!application) return null;
    return {
      id: application.id,
      storeName: application.storeName,
      requestedSlug: application.requestedSlug,
      description: application.description,
      status: toPublicStatus(application.status) as SellerPublicStatus,
      submittedAt: application.submittedAt?.toISOString() ?? null,
      rejectionCode: application.rejectionCode,
      rejectionReason: application.rejectionReason,
    };
  }
  private mapProfile(profile: SellerProfile | null): ProfilePublic | null {
    if (!profile) return null;
    return {
      id: profile.id,
      storeName: profile.storeName,
      slug: profile.slug,
      description: profile.description,
      status: profileStatusApi[profile.status],
      verified: profile.verified,
    };
  }
  private agreementState(
    application: Pick<
      SellerApplication,
      'sellerAgreementVersion' | 'sellerAgreementAcceptedAt'
    > | null,
    currentVersion = this.version(),
  ) {
    const accepted = !!application?.sellerAgreementAcceptedAt;
    return {
      sellerAgreementVersion: currentVersion,
      sellerAgreementAccepted: accepted && application?.sellerAgreementVersion === currentVersion,
      sellerAgreementCurrent: accepted && application?.sellerAgreementVersion === currentVersion,
    };
  }
  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { sellerApplication: true, sellerProfile: true },
    });
    return {
      application: this.mapApp(user.sellerApplication),
      sellerProfile: this.mapProfile(user.sellerProfile),
      requirements: {
        ...requirementsFor(user, this.version()),
        ...this.agreementState(user.sellerApplication),
      },
    };
  }
  private validateDto(dto: UpsertSellerApplicationDto) {
    const storeName = validateStoreName(dto.storeName);
    if (!storeName) throw this.appError('SELLER_STORE_NAME_INVALID');
    const requestedSlug = validateSellerSlug(dto.requestedSlug);
    if (!requestedSlug) throw this.appError('SELLER_SLUG_INVALID');
    const description = validateSellerDescription(dto.description);
    if (description === undefined) throw this.appError('SELLER_DESCRIPTION_INVALID');
    return { storeName, requestedSlug, description };
  }
  private agreementWrite(
    dto: UpsertSellerApplicationDto,
    existing?: Pick<
      SellerApplication,
      'sellerAgreementVersion' | 'sellerAgreementAcceptedAt'
    > | null,
  ) {
    const version = this.version();
    if (!dto.sellerAgreementAccepted)
      return { sellerAgreementVersion: null, sellerAgreementAcceptedAt: null };
    if (existing?.sellerAgreementVersion === version && existing.sellerAgreementAcceptedAt)
      return {};
    return { sellerAgreementVersion: version, sellerAgreementAcceptedAt: new Date() };
  }
  private assertAgreementCurrent(
    application: Pick<SellerApplication, 'sellerAgreementVersion' | 'sellerAgreementAcceptedAt'>,
  ) {
    if (!application.sellerAgreementAcceptedAt)
      throw this.appError('SELLER_AGREEMENT_REQUIRED', HttpStatus.CONFLICT);
    if (application.sellerAgreementVersion !== this.version())
      throw this.appError('SELLER_AGREEMENT_VERSION_OUTDATED', HttpStatus.CONFLICT);
  }
  async saveDraft(userId: string, dto: UpsertSellerApplicationDto): Promise<ApplicationPublic> {
    const data = this.validateDto(dto);
    return serializableTransactionWithRetry(this.prisma, async (tx) => {
      const existing = await tx.sellerApplication.findUnique({ where: { userId } });
      if (
        existing &&
        existing.status !== SellerApplicationStatus.DRAFT &&
        existing.status !== SellerApplicationStatus.REJECTED
      )
        throw this.appError('SELLER_APPLICATION_NOT_EDITABLE', HttpStatus.CONFLICT);
      const agreement = this.agreementWrite(dto, existing);
      const app = await tx.sellerApplication.upsert({
        where: { userId },
        create: { userId, ...data, ...agreement, status: SellerApplicationStatus.DRAFT },
        update: {
          ...data,
          ...agreement,
          status: SellerApplicationStatus.DRAFT,
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
            previousStatus: existing?.status ?? null,
            newStatus: app.status,
            origin: 'user',
            agreementAccepted: dto.sellerAgreementAccepted,
          },
        },
      });
      return this.mapApp(app)!;
    });
  }
  private async assertRequirements(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<OwnerUser> {
    const user = await tx.user.findUnique({
      where: { id: userId },
      include: { roleAssignments: { select: { role: true } } },
    });
    if (!user || user.status !== UserStatus.ACTIVE)
      throw this.appError('SELLER_REQUIREMENTS_NOT_MET', HttpStatus.FORBIDDEN);
    if (!user.roleAssignments.some((r) => r.role === PlatformRole.BUYER))
      throw this.appError('SELLER_REQUIREMENTS_NOT_MET', HttpStatus.FORBIDDEN);
    if (!user.emailVerifiedAt)
      throw this.appError('SELLER_EMAIL_NOT_VERIFIED', HttpStatus.FORBIDDEN);
    if (!user.phoneVerifiedAt)
      throw this.appError('SELLER_PHONE_NOT_VERIFIED', HttpStatus.FORBIDDEN);
    if (!requirementsFor(user, this.version()).ageEligible)
      throw this.appError('SELLER_AGE_REQUIREMENT_NOT_MET', HttpStatus.FORBIDDEN);
    return user;
  }
  async submit(userId: string): Promise<ApplicationPublic> {
    return serializableTransactionWithRetry(this.prisma, async (tx) => {
      await this.assertRequirements(tx, userId);
      const app = await tx.sellerApplication.findUnique({ where: { userId } });
      if (!app) throw this.appError('SELLER_APPLICATION_NOT_FOUND', HttpStatus.NOT_FOUND);
      if (app.status === SellerApplicationStatus.SUBMITTED) return this.mapApp(app)!;
      if (app.status !== SellerApplicationStatus.DRAFT)
        throw this.appError('SELLER_APPLICATION_INVALID_TRANSITION', HttpStatus.CONFLICT);
      this.assertAgreementCurrent(app);
      const slug = validateSellerSlug(app.requestedSlug);
      if (!slug) throw this.appError('SELLER_SLUG_INVALID');
      const profile = await tx.sellerProfile.findUnique({ where: { slug } });
      if (profile) throw this.appError('SELLER_SLUG_UNAVAILABLE', HttpStatus.CONFLICT);
      const updated = await tx.sellerApplication.update({
        where: { id: app.id },
        data: { status: SellerApplicationStatus.SUBMITTED, submittedAt: new Date() },
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
      return this.mapApp(updated)!;
    });
  }
  async slugAvailability(slugRaw: string) {
    const slug = validateSellerSlug(slugRaw);
    if (!slug) throw this.appError('SELLER_SLUG_INVALID');
    const profile = await this.prisma.sellerProfile.findUnique({ where: { slug } });
    return { slug, available: !profile };
  }
  async listAdmin(query: AdminSellerApplicationsQueryDto) {
    const where: Prisma.SellerApplicationWhereInput = {};
    if (query.status) where.status = publicToDbStatus[query.status];
    if (query.search)
      where.OR = [
        { storeName: { contains: query.search, mode: 'insensitive' } },
        { requestedSlug: { contains: query.search, mode: 'insensitive' } },
      ];
    const take = query.limit ?? 20;
    const rows = await this.prisma.sellerApplication.findMany({
      where,
      orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
      take: take + 1,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      skip: query.cursor ? 1 : 0,
      include: {
        user: {
          select: { emailVerifiedAt: true, phoneVerifiedAt: true, birthDate: true, status: true },
        },
      },
    });
    const items = rows.slice(0, take);
    return {
      items: items.map((a: ApplicationWithRequirementUser) => ({
        ...this.mapApp(a),
        requirements: {
          ...requirementsFor(a.user, this.version()),
          ...this.agreementState(a, this.version()),
        },
      })),
      nextCursor: rows.length > take && items.length > 0 ? items[items.length - 1].id : null,
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
    return {
      ...this.mapApp(app),
      requirements: {
        ...requirementsFor(app.user, this.version()),
        ...this.agreementState(app, this.version()),
      },
    };
  }
  async startReview(id: string, adminUserId: string): Promise<ApplicationPublic> {
    return serializableTransactionWithRetry(this.prisma, async (tx) => {
      const app = await tx.sellerApplication.findUnique({ where: { id } });
      if (!app) throw new NotFoundException({ code: 'SELLER_APPLICATION_NOT_FOUND' });
      if (app.status === SellerApplicationStatus.UNDER_REVIEW) return this.mapApp(app)!;
      if (!assertTransition(app.status, SellerApplicationStatus.UNDER_REVIEW))
        throw this.appError('SELLER_APPLICATION_INVALID_TRANSITION', HttpStatus.CONFLICT);
      const updated = await tx.sellerApplication.update({
        where: { id },
        data: { status: SellerApplicationStatus.UNDER_REVIEW },
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
      return this.mapApp(updated)!;
    });
  }
  async reject(
    id: string,
    adminUserId: string,
    dto: RejectSellerApplicationDto,
  ): Promise<ApplicationPublic> {
    if (dto.reason && /[<>]/.test(dto.reason))
      throw this.appError('SELLER_REJECTION_REASON_INVALID');
    return serializableTransactionWithRetry(this.prisma, async (tx) => {
      const app = await tx.sellerApplication.findUnique({ where: { id } });
      if (!app) throw new NotFoundException({ code: 'SELLER_APPLICATION_NOT_FOUND' });
      if (
        app.status !== SellerApplicationStatus.SUBMITTED &&
        app.status !== SellerApplicationStatus.UNDER_REVIEW
      )
        throw this.appError('SELLER_APPLICATION_INVALID_TRANSITION', HttpStatus.CONFLICT);
      const updated = await tx.sellerApplication.update({
        where: { id },
        data: {
          status: SellerApplicationStatus.REJECTED,
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
      return this.mapApp(updated)!;
    });
  }
  async approve(id: string, adminUserId: string): Promise<ApplicationPublic> {
    try {
      return await serializableTransactionWithRetry(this.prisma, async (tx) => {
        const app = await tx.sellerApplication.findUnique({ where: { id } });
        if (!app) throw new NotFoundException({ code: 'SELLER_APPLICATION_NOT_FOUND' });
        if (app.status === SellerApplicationStatus.APPROVED) return this.mapApp(app)!;
        if (
          app.status !== SellerApplicationStatus.SUBMITTED &&
          app.status !== SellerApplicationStatus.UNDER_REVIEW
        )
          throw this.appError('SELLER_APPLICATION_INVALID_TRANSITION', HttpStatus.CONFLICT);
        await this.assertRequirements(tx, app.userId);
        this.assertAgreementCurrent(app);
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
          data: {
            status: SellerApplicationStatus.APPROVED,
            reviewedAt: new Date(),
            reviewedByUserId: adminUserId,
          },
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
        return this.mapApp(updated)!;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
        throw new ConflictException({ code: 'SELLER_APPROVAL_CONFLICT' });
      throw e;
    }
  }
}
