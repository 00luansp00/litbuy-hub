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
  user: { findUnique(args: unknown): Promise<{ status: UserStatus } | null> };
  userRoleAssignment: {
    findUnique(args: unknown): Promise<object | null>;
    createMany(args: unknown): Promise<{ count: number }>;
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

function isSerializationConflict(error: unknown): boolean {
  return (
    (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') ||
    (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034')
  );
}

export async function serializableTransactionWithRetry<T>(
  prisma: PrismaLike,
  operation: (tx: Tx) => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      lastError = error;
      if (!isSerializationConflict(error) || attempt === maxAttempts) break;
    }
  }
  if (isSerializationConflict(lastError)) {
    throw new PlatformRoleOperationError('SERIALIZABLE_TRANSACTION_RETRY_EXHAUSTED');
  }
  throw lastError;
}

async function audit(
  tx: Tx,
  userId: string,
  eventType: SecurityEventType,
  outcome: SecurityEventOutcome,
  role: PlatformRole,
  origin: RoleOperationOrigin,
  result: RoleOperationResult['result'],
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
  return prisma.$transaction(async (tx) => {
    const created = await tx.userRoleAssignment.createMany({
      data: [{ userId, role }],
      skipDuplicates: true,
    });
    const changed = created.count === 1;
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
  });
}

export async function revokePlatformRole(
  prisma: PrismaLike,
  userId: string,
  role: PlatformRole,
  origin: RoleOperationOrigin,
): Promise<RoleOperationResult> {
  if (role === PlatformRole.BUYER)
    throw new PlatformRoleOperationError('BUYER_ROLE_REVOKE_DISABLED');
  return serializableTransactionWithRetry(prisma, async (tx) => {
    if (role === PlatformRole.ADMIN) {
      const targetHasAdmin = await tx.userRoleAssignment.findUnique({
        where: { userId_role: { userId, role } },
      });
      if (targetHasAdmin) {
        const [targetUser, totalAdmins, activeAdmins] = await Promise.all([
          tx.user.findUnique({ where: { id: userId }, select: { status: true } }),
          tx.userRoleAssignment.count({ where: { role: PlatformRole.ADMIN } }),
          tx.userRoleAssignment.count({
            where: { role: PlatformRole.ADMIN, user: { status: UserStatus.ACTIVE } },
          }),
        ]);
        const removesLastTotalAdmin = totalAdmins <= 1;
        const removesLastActiveAdmin =
          targetUser?.status === UserStatus.ACTIVE && activeAdmins <= 1;
        if (removesLastTotalAdmin || removesLastActiveAdmin) {
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
  });
}
