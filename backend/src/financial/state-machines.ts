import { FinancialDomainError } from './financial.errors';

type Graph = Readonly<Record<string, readonly string[]>>;
const graphs = {
  payment: {
    NOT_CREATED: [],
    PENDING: ['PROCESSING', 'PAID', 'FAILED', 'EXPIRED'],
    PROCESSING: ['PAID', 'FAILED', 'EXPIRED'],
    PAID: ['REFUND_PENDING', 'CHARGEBACK'],
    REFUND_PENDING: ['PARTIALLY_REFUNDED', 'REFUNDED', 'PAID'],
    PARTIALLY_REFUNDED: ['REFUND_PENDING', 'REFUNDED', 'CHARGEBACK'],
    REFUNDED: [],
    FAILED: [],
    EXPIRED: [],
    CHARGEBACK: [],
  },
  paymentAttempt: {
    CREATED: ['PENDING', 'PROCESSING', 'CANCELLED'],
    PENDING: ['PROCESSING', 'REQUIRES_ACTION', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'CANCELLED'],
    PROCESSING: ['REQUIRES_ACTION', 'SUCCEEDED', 'FAILED', 'EXPIRED'],
    REQUIRES_ACTION: ['PROCESSING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'CANCELLED'],
    SUCCEEDED: [],
    FAILED: [],
    EXPIRED: [],
    CANCELLED: [],
  },
  providerAccount: {
    PENDING_ONBOARDING: ['PENDING_KYC', 'ACTIVE', 'CLOSED'],
    PENDING_KYC: ['ACTIVE', 'RESTRICTED', 'CLOSED'],
    ACTIVE: ['RESTRICTED', 'SUSPENDED', 'CLOSED'],
    RESTRICTED: ['ACTIVE', 'SUSPENDED', 'CLOSED'],
    SUSPENDED: ['ACTIVE', 'CLOSED'],
    CLOSED: [],
  },
  hold: {
    ACTIVE: ['RELEASE_ELIGIBLE', 'BLOCKED', 'CANCELLED'],
    RELEASE_ELIGIBLE: ['RELEASE_REQUESTED', 'BLOCKED', 'CANCELLED'],
    RELEASE_REQUESTED: ['RELEASED', 'BLOCKED'],
    BLOCKED: ['ACTIVE', 'CANCELLED'],
    RELEASED: [],
    CANCELLED: [],
  },
  settlement: {
    PENDING: ['HELD', 'AVAILABLE', 'FAILED'],
    HELD: ['AVAILABLE', 'REVERSED', 'FAILED'],
    AVAILABLE: ['REVERSED'],
    REVERSED: [],
    FAILED: [],
  },
  transfer: {
    CREATED: ['PENDING', 'PROCESSING', 'CANCELLED'],
    PENDING: ['PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED'],
    PROCESSING: ['SUCCEEDED', 'FAILED'],
    SUCCEEDED: [],
    FAILED: [],
    CANCELLED: [],
  },
  withdrawal: {
    REQUESTED: ['PENDING_REVIEW', 'CANCELLED'],
    PENDING_REVIEW: ['APPROVED', 'REJECTED', 'CANCELLED'],
    APPROVED: ['PROCESSING', 'CANCELLED'],
    PROCESSING: ['SUCCEEDED', 'FAILED'],
    SUCCEEDED: [],
    REJECTED: [],
    FAILED: [],
    CANCELLED: [],
  },
  refund: {
    REQUESTED: ['PROCESSING', 'CANCELLED'],
    PROCESSING: ['SUCCEEDED', 'FAILED'],
    SUCCEEDED: [],
    FAILED: [],
    CANCELLED: [],
  },
  chargeback: {
    OPEN: ['EVIDENCE_REQUIRED', 'CONTESTED', 'LOST', 'CLOSED'],
    EVIDENCE_REQUIRED: ['CONTESTED', 'LOST', 'CLOSED'],
    CONTESTED: ['WON', 'LOST'],
    WON: ['CLOSED'],
    LOST: ['CLOSED'],
    CLOSED: [],
  },
  webhook: {
    RECEIVED: ['PROCESSING', 'IGNORED'],
    PROCESSING: ['PROCESSED', 'FAILED', 'IGNORED'],
    FAILED: ['PROCESSING', 'DEAD_LETTER'],
    PROCESSED: [],
    DEAD_LETTER: [],
    IGNORED: [],
  },
  reconciliation: {
    OPEN: ['INVESTIGATING', 'RESOLVED'],
    INVESTIGATING: ['RESOLVED'],
    RESOLVED: [],
  },
  feePolicy: {
    DRAFT: ['SCHEDULED', 'ACTIVE', 'RETIRED'],
    SCHEDULED: ['ACTIVE', 'RETIRED'],
    ACTIVE: ['RETIRED'],
    RETIRED: [],
  },
  withdrawalPolicy: {
    DRAFT: ['SCHEDULED', 'ACTIVE', 'RETIRED'],
    SCHEDULED: ['ACTIVE', 'RETIRED'],
    ACTIVE: ['RETIRED'],
    RETIRED: [],
  },
} as const satisfies Record<string, Graph>;
export type StateMachine = keyof typeof graphs;
export function assertFinancialTransition(machine: StateMachine, from: string, to: string): void {
  const allowed = (graphs[machine] as Graph)[from] ?? [];
  if (!allowed.includes(to))
    throw new FinancialDomainError('INVALID_TRANSITION', `${machine}: ${from} -> ${to}`);
}
export const canFinancialTransition = (
  machine: StateMachine,
  from: string,
  to: string,
): boolean => {
  try {
    assertFinancialTransition(machine, from, to);
    return true;
  } catch {
    return false;
  }
};
