import { Injectable } from '@nestjs/common';
import { PlatformRole, SecurityEventOutcome, SecurityEventType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export type RoleOperationOrigin = 'cli' | 'system' | 'test';

@Injectable()
export class PlatformRolesService {
  constructor(private readonly prisma: PrismaService) {}

  async rolesForUser(userId: string): Promise<PlatformRole[]> {
    const rows = await this.prisma.userRoleAssignment.findMany({
      where: { userId },
      select: { role: true },
      orderBy: { role: 'asc' },
    });
    return rows.map((row) => row.role);
  }

  async userHasAnyRole(userId: string, required: PlatformRole[]): Promise<boolean> {
    if (required.length === 0) return true;
    const count = await this.prisma.userRoleAssignment.count({
      where: { userId, role: { in: required } },
    });
    return count > 0;
  }

  async grantRole(
    userId: string,
    role: PlatformRole,
    origin: RoleOperationOrigin,
  ): Promise<boolean> {
    const created = await this.prisma.$transaction(async (tx) => {
      const assignment = await tx.userRoleAssignment.upsert({
        where: { userId_role: { userId, role } },
        create: { userId, role },
        update: {},
      });
      await tx.securityEvent.create({
        data: {
          userId,
          eventType: SecurityEventType.ROLE_GRANTED,
          outcome: SecurityEventOutcome.SUCCESS,
          metadata: { role, origin, result: 'granted', targetUserId: userId },
        },
      });
      return assignment;
    });
    return !!created;
  }

  async revokeRole(
    userId: string,
    role: PlatformRole,
    origin: RoleOperationOrigin,
  ): Promise<boolean> {
    if (role === PlatformRole.BUYER) throw new Error('BUYER_ROLE_REVOKE_DISABLED');
    const deleted = await this.prisma.$transaction(async (tx) => {
      const result = await tx.userRoleAssignment.deleteMany({ where: { userId, role } });
      await tx.securityEvent.create({
        data: {
          userId,
          eventType: SecurityEventType.ROLE_REVOKED,
          outcome: SecurityEventOutcome.SUCCESS,
          metadata: {
            role,
            origin,
            result: result.count > 0 ? 'revoked' : 'unchanged',
            targetUserId: userId,
          },
        },
      });
      return result.count > 0;
    });
    return deleted;
  }
}
