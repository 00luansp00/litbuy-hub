import type { Prisma } from '@prisma/client';

/** Acquires a PostgreSQL transaction-scoped advisory lock without selecting its void result. */
export async function acquireAdvisoryTransactionLock(
  tx: Prisma.TransactionClient,
  lockKey: string,
): Promise<void> {
  await tx.$queryRaw<Array<{ locked: number }>>`
    SELECT 1::int AS locked
    FROM pg_advisory_xact_lock(hashtext(${lockKey}))
  `;
}
