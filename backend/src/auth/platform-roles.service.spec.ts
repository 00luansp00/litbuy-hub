/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/consistent-type-imports */
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlatformRole, SecurityEventOutcome, SecurityEventType, UserStatus } from '@prisma/client';
import { PlatformRolesGuard } from './platform-roles.guard';
import { RequireRoles, PLATFORM_ROLES_KEY, toPlatformRoleApiValues } from './platform-roles';
import { PlatformRolesService } from './platform-roles.service';
import { grantPlatformRole, revokePlatformRole } from './platform-role-operations';

type Assignment = { userId: string; role: PlatformRole; user?: { status: UserStatus } };
type Event = {
  data: { eventType: SecurityEventType; outcome: SecurityEventOutcome; metadata: any };
};

class FakePrisma {
  assignments: Assignment[] = [];
  events: Event[] = [];
  failAudit = false;
  failCount = false;
  async $transaction<T>(fn: (tx: this) => Promise<T>) {
    const beforeAssignments = structuredClone(this.assignments) as Assignment[];
    const beforeEvents = structuredClone(this.events) as Event[];
    try {
      return await fn(this);
    } catch (error) {
      this.assignments = beforeAssignments;
      this.events = beforeEvents;
      throw error;
    }
  }
  userRoleAssignment = {
    findMany: async ({ where }: { where?: { userId?: string } }) =>
      this.assignments.filter((a) => !where?.userId || a.userId === where.userId),
    count: async ({
      where,
    }: { where?: { userId?: string; role?: any; user?: { status: UserStatus } } } = {}) => {
      if (this.failCount) throw new Error('db down');
      return this.assignments.filter((a) => {
        if (where?.userId && a.userId !== where.userId) return false;
        if (where?.role) {
          if (typeof where.role === 'object' && 'in' in where.role) {
            if (!where.role.in.includes(a.role)) return false;
          } else if (a.role !== where.role) return false;
        }
        if (where?.user?.status && a.user?.status !== where.user.status) return false;
        return true;
      }).length;
    },
    findUnique: async ({
      where,
    }: {
      where: { userId_role: { userId: string; role: PlatformRole } };
    }) =>
      this.assignments.find(
        (a) => a.userId === where.userId_role.userId && a.role === where.userId_role.role,
      ) ?? null,
    create: async ({ data }: { data: Assignment }) => {
      if (this.assignments.some((a) => a.userId === data.userId && a.role === data.role)) {
        const error = new Error('Unique constraint') as Error & { code: string };
        error.code = 'P2002';
        throw error;
      }
      this.assignments.push({ ...data, user: { status: UserStatus.ACTIVE } });
      return data;
    },
    deleteMany: async ({ where }: { where: { userId: string; role: PlatformRole } }) => {
      const before = this.assignments.length;
      this.assignments = this.assignments.filter(
        (a) => !(a.userId === where.userId && a.role === where.role),
      );
      return { count: before - this.assignments.length };
    },
  };
  securityEvent = {
    create: async (event: Event) => {
      if (this.failAudit) throw new Error('audit failed');
      this.events.push(event);
      return event;
    },
  };
}

function context(auth?: unknown, headerRole?: string) {
  return {
    getHandler: () => 'handler',
    getClass: () => 'class',
    switchToHttp: () => ({
      getRequest: () => ({
        auth,
        headers: { 'x-role': headerRole },
        body: { role: 'ADMIN' },
        query: { role: 'ADMIN' },
      }),
    }),
  } as any;
}

describe('platform role helpers and service', () => {
  it('orders API role values deterministically', () => {
    expect(
      toPlatformRoleApiValues([PlatformRole.ADMIN, PlatformRole.BUYER, PlatformRole.SELLER]),
    ).toEqual(['buyer', 'seller', 'admin']);
  });

  it('reads rolesForUser and userHasAnyRole from current assignments', async () => {
    const prisma = new FakePrisma();
    prisma.assignments.push({ userId: 'u1', role: PlatformRole.SELLER });
    const service = new PlatformRolesService(prisma as any);
    expect(await service.rolesForUser('u1')).toEqual([PlatformRole.SELLER]);
    expect(await service.userHasAnyRole('u1', [PlatformRole.ADMIN, PlatformRole.SELLER])).toBe(
      true,
    );
    expect(await service.userHasAnyRole('u1', [PlatformRole.ADMIN])).toBe(false);
  });

  it('grants new roles and audits granted', async () => {
    const prisma = new FakePrisma();
    await expect(
      grantPlatformRole(prisma as any, 'u1', PlatformRole.SELLER, 'test'),
    ).resolves.toEqual({ changed: true, result: 'granted' });
    expect(prisma.events[0]!.data.metadata.result).toBe('granted');
  });

  it('repeated grant returns unchanged and does not falsely audit granted', async () => {
    const prisma = new FakePrisma();
    prisma.assignments.push({
      userId: 'u1',
      role: PlatformRole.SELLER,
      user: { status: UserStatus.ACTIVE },
    });
    await expect(
      grantPlatformRole(prisma as any, 'u1', PlatformRole.SELLER, 'test'),
    ).resolves.toEqual({ changed: false, result: 'unchanged' });
    expect(prisma.events[0]!.data.metadata.result).toBe('unchanged');
  });

  it('revoke existing and missing roles are idempotent', async () => {
    const prisma = new FakePrisma();
    prisma.assignments.push({
      userId: 'u1',
      role: PlatformRole.SELLER,
      user: { status: UserStatus.ACTIVE },
    });
    await expect(
      revokePlatformRole(prisma as any, 'u1', PlatformRole.SELLER, 'test'),
    ).resolves.toEqual({ changed: true, result: 'revoked' });
    await expect(
      revokePlatformRole(prisma as any, 'u1', PlatformRole.SELLER, 'test'),
    ).resolves.toEqual({ changed: false, result: 'unchanged' });
  });

  it('blocks BUYER and last ADMIN revocation but allows ADMIN when another active admin remains', async () => {
    const prisma = new FakePrisma();
    await expect(
      revokePlatformRole(prisma as any, 'u1', PlatformRole.BUYER, 'test'),
    ).rejects.toMatchObject({ code: 'BUYER_ROLE_REVOKE_DISABLED' });
    prisma.assignments.push({
      userId: 'u1',
      role: PlatformRole.ADMIN,
      user: { status: UserStatus.ACTIVE },
    });
    await expect(
      revokePlatformRole(prisma as any, 'u1', PlatformRole.ADMIN, 'test'),
    ).rejects.toMatchObject({ code: 'LAST_ACTIVE_ADMIN_REVOKE_BLOCKED' });
    prisma.assignments.push({
      userId: 'u2',
      role: PlatformRole.ADMIN,
      user: { status: UserStatus.ACTIVE },
    });
    await expect(
      revokePlatformRole(prisma as any, 'u1', PlatformRole.ADMIN, 'test'),
    ).resolves.toEqual({ changed: true, result: 'revoked' });
  });

  it('rolls back assignment when audit fails and propagates database failures', async () => {
    const prisma = new FakePrisma();
    prisma.failAudit = true;
    await expect(
      grantPlatformRole(prisma as any, 'u1', PlatformRole.SELLER, 'test'),
    ).rejects.toThrow('audit failed');
    expect(prisma.assignments).toHaveLength(0);
    prisma.failAudit = false;
    prisma.failCount = true;
    await expect(
      new PlatformRolesService(prisma as any).userHasAnyRole('u1', [PlatformRole.ADMIN]),
    ).rejects.toThrow('db down');
  });
});

describe('RequireRoles and PlatformRolesGuard', () => {
  it('stores metadata including explicit empty metadata', () => {
    const decorator = RequireRoles();
    class Example {}
    decorator(Example);
    expect(Reflect.getMetadata(PLATFORM_ROLES_KEY, Example)).toEqual([]);
  });

  it('does not interfere without metadata or empty metadata', async () => {
    const guard = new PlatformRolesGuard(
      { getAllAndOverride: () => undefined } as unknown as Reflector,
      { userHasAnyRole: jest.fn() } as any,
    );
    await expect(guard.canActivate(context())).resolves.toBe(true);
    const empty = new PlatformRolesGuard(
      { getAllAndOverride: () => [] } as unknown as Reflector,
      { userHasAnyRole: jest.fn() } as any,
    );
    await expect(empty.canActivate(context())).resolves.toBe(true);
  });

  it('uses any-role semantics and ignores header/body/query roles', async () => {
    const service = { userHasAnyRole: jest.fn().mockResolvedValue(true) };
    const guard = new PlatformRolesGuard(
      {
        getAllAndOverride: () => [PlatformRole.ADMIN, PlatformRole.SELLER],
      } as unknown as Reflector,
      service as any,
    );
    await expect(guard.canActivate(context({ userId: 'u1' }, 'ADMIN'))).resolves.toBe(true);
    expect(service.userHasAnyRole).toHaveBeenCalledWith('u1', [
      PlatformRole.ADMIN,
      PlatformRole.SELLER,
    ]);
  });

  it('returns 403 without auth, without required role, or on database failure', async () => {
    const reflector = { getAllAndOverride: () => [PlatformRole.ADMIN] } as unknown as Reflector;
    await expect(
      new PlatformRolesGuard(reflector, { userHasAnyRole: jest.fn() } as any).canActivate(
        context(),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      new PlatformRolesGuard(reflector, {
        userHasAnyRole: jest.fn().mockResolvedValue(false),
      } as any).canActivate(context({ userId: 'u1' })),
    ).rejects.toMatchObject({ response: { code: 'INSUFFICIENT_ROLE' } });
    await expect(
      new PlatformRolesGuard(reflector, {
        userHasAnyRole: jest.fn().mockRejectedValue(new Error('db')),
      } as any).canActivate(context({ userId: 'u1' })),
    ).rejects.toMatchObject({ response: { code: 'INSUFFICIENT_ROLE' } });
  });

  it('observes removed roles on the next evaluation', async () => {
    let allowed = true;
    const guard = new PlatformRolesGuard(
      { getAllAndOverride: () => [PlatformRole.SELLER] } as unknown as Reflector,
      { userHasAnyRole: jest.fn().mockImplementation(() => Promise.resolve(allowed)) } as any,
    );
    await expect(guard.canActivate(context({ userId: 'u1' }))).resolves.toBe(true);
    allowed = false;
    await expect(guard.canActivate(context({ userId: 'u1' }))).rejects.toMatchObject({
      response: { code: 'INSUFFICIENT_ROLE' },
    });
  });
});
