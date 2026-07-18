import {
  Prisma,
  PlatformRole,
  SecurityEventOutcome,
  SecurityEventType,
  UserStatus,
} from '@prisma/client';

export type RoleOperationOrigin = 'cli' | 'system' | 'test';
export type RoleOperationResult = { changed: boolean; result: 'granted' | 'revoked' | 'unchanged' };

type Tx = {
  userRoleAssignment: {
    findUnique(args: unknown): Promise<object | null>;
    create(args: unknown): Promise<object>;
    deleteMany(args: unknown): Promise<{ count: number }>;
    count(args?: unknown): Promise<number>;
  };
  securityEvent: { create(args: unknown): Promise<object> };
};

type PrismaLike = Tx & {
  $transaction<T>(fn: (tx: Tx) => Promise<T>, options?: object): Promise<T>;
};

export class PlatformRoleOperationError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

function isUniqueConflict(error: unknown): boolean {
  return (
    (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') ||
    (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002')
  );
}

async function audit(
  tx: Tx,
  userId: string,
  eventType: SecurityEventType,
  outcome: SecurityEventOutcome,
  role: PlatformRole,
  origin: RoleOperationOrigin,
  result: RoleOperationResult['result'] | 'blocked',
): Promise<void> {
  await tx.securityEvent.create({
    data: {
      userId,
      eventType,
      outcome,
      metadata: { role, origin, result, targetUserId: userId },
    },
  });
}

export async function grantPlatformRole(
  prisma: PrismaLike,
  userId: string,
  role: PlatformRole,
  origin: RoleOperationOrigin,
): Promise<RoleOperationResult> {
  return prisma.$transaction(
    async (tx) => {
      let changed = false;
      try {
        await tx.userRoleAssignment.create({ data: { userId, role } });
        changed = true;
      } catch (error) {
        if (!isUniqueConflict(error)) throw error;
      }
      const result = changed ? 'granted' : 'unchanged';
      await audit(
        tx,
        userId,
        SecurityEventType.ROLE_GRANTED,
        SecurityEventOutcome.SUCCESS,
        role,
        origin,
        result,
      );
      return { changed, result };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function revokePlatformRole(
  prisma: PrismaLike,
  userId: string,
  role: PlatformRole,
  origin: RoleOperationOrigin,
): Promise<RoleOperationResult> {
  if (role === PlatformRole.BUYER)
    throw new PlatformRoleOperationError('BUYER_ROLE_REVOKE_DISABLED');
  return prisma.$transaction(
    async (tx) => {
      if (role === PlatformRole.ADMIN) {
        const targetHasAdmin = await tx.userRoleAssignment.findUnique({
          where: { userId_role: { userId, role } },
        });
        if (targetHasAdmin) {
          const [totalAdmins, activeAdmins] = await Promise.all([
            tx.userRoleAssignment.count({ where: { role: PlatformRole.ADMIN } }),
            tx.userRoleAssignment.count({
              where: { role: PlatformRole.ADMIN, user: { status: UserStatus.ACTIVE } },
            }),
          ]);
          if (totalAdmins <= 1 || activeAdmins <= 1) {
            await audit(
              tx,
              userId,
              SecurityEventType.ROLE_REVOKED,
              SecurityEventOutcome.BLOCKED,
              role,
              origin,
              'blocked',
            );
            throw new PlatformRoleOperationError('LAST_ACTIVE_ADMIN_REVOKE_BLOCKED');
          }
        }
      }
      const deleted = await tx.userRoleAssignment.deleteMany({ where: { userId, role } });
      const changed = deleted.count > 0;
      const result = changed ? 'revoked' : 'unchanged';
      await audit(
        tx,
        userId,
        SecurityEventType.ROLE_REVOKED,
        SecurityEventOutcome.SUCCESS,
        role,
        origin,
        result,
      );
      return { changed, result };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
