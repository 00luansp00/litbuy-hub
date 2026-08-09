import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export const SELLER_RELEASE_POLICY_RULE_CODE = 'DELIVERY_PROTECTION_DEFAULT';

export type EffectiveSellerReleasePolicy = {
  policyVersionId: string;
  publicVersion: number;
  ruleId: string;
  ruleCode: string;
  delayHours: number;
};

export class SellerReleasePolicyError extends Error {
  constructor(
    public readonly code: 'SELLER_RELEASE_POLICY_NOT_FOUND' | 'SELLER_RELEASE_POLICY_AMBIGUOUS',
  ) {
    super(code);
  }
}

type QueryClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class SellerReleasePolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveEffectivePolicy(
    tx?: Prisma.TransactionClient,
  ): Promise<EffectiveSellerReleasePolicy> {
    return this.resolveWithClient(tx ?? this.prisma);
  }

  private async resolveWithClient(client: QueryClient): Promise<EffectiveSellerReleasePolicy> {
    const policies = await client.$queryRaw<Array<{ id: string; publicVersion: number }>>`
      SELECT "id", "publicVersion"
      FROM "SellerReleasePolicyVersion"
      WHERE "status" = 'ACTIVE'
        AND "effectiveFrom" <= transaction_timestamp()
        AND ("effectiveTo" IS NULL OR "effectiveTo" > transaction_timestamp())
      ORDER BY "id"
      LIMIT 2
      FOR SHARE
    `;
    if (policies.length === 0)
      throw new SellerReleasePolicyError('SELLER_RELEASE_POLICY_NOT_FOUND');
    if (policies.length !== 1)
      throw new SellerReleasePolicyError('SELLER_RELEASE_POLICY_AMBIGUOUS');

    const rules = await client.sellerReleasePolicyRule.findMany({
      where: { policyVersionId: policies[0].id, enabled: true },
      select: { id: true, code: true, delayHours: true },
      take: 2,
    });
    if (rules.length === 0) throw new SellerReleasePolicyError('SELLER_RELEASE_POLICY_NOT_FOUND');
    if (rules.length !== 1 || rules[0].code !== SELLER_RELEASE_POLICY_RULE_CODE)
      throw new SellerReleasePolicyError('SELLER_RELEASE_POLICY_AMBIGUOUS');
    return {
      policyVersionId: policies[0].id,
      publicVersion: policies[0].publicVersion,
      ruleId: rules[0].id,
      ruleCode: rules[0].code,
      delayHours: rules[0].delayHours,
    };
  }
}
