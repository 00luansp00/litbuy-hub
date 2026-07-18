import { Injectable } from '@nestjs/common';
import { PlatformRole } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  grantPlatformRole,
  revokePlatformRole,
  type RoleOperationOrigin,
  type RoleOperationResult,
} from './platform-role-operations';

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
    if (required.length === 0) return false;
    const count = await this.prisma.userRoleAssignment.count({
      where: { userId, role: { in: required } },
    });
    return count > 0;
  }

  async grantRole(
    userId: string,
    role: PlatformRole,
    origin: RoleOperationOrigin,
  ): Promise<RoleOperationResult> {
    return grantPlatformRole(this.prisma, userId, role, origin);
  }

  async revokeRole(
    userId: string,
    role: PlatformRole,
    origin: RoleOperationOrigin,
  ): Promise<RoleOperationResult> {
    return revokePlatformRole(this.prisma, userId, role, origin);
  }
}
