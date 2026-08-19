import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export const SELLER_RELEASE_POLICY_RULE_CODE = 'DELIVERY_PROTECTION_DEFAULT';

export type SellerReleasePolicyClassification = {
  categoryId?: string;
  subcategoryId?: string;
};

export type EffectiveSellerReleasePolicy = {
  policyVersionId: string;
  publicVersion: number;
  ruleId: string;
  ruleCode: string;
  delayHours: number;
  source: 'DEFAULT' | 'CATEGORY' | 'SUBCATEGORY';
  categoryId: string | null;
  subcategoryId: string | null;
};

export class SellerReleasePolicyError extends Error {
  constructor(
    public readonly code: 'SELLER_RELEASE_POLICY_NOT_FOUND' | 'SELLER_RELEASE_POLICY_AMBIGUOUS',
  ) {
    super(code);
  }
}

type QueryClient = Prisma.TransactionClient | PrismaService;
type MatchingRule = {
  id: string;
  code: string;
  delayHours: number;
  scope: EffectiveSellerReleasePolicy['source'];
  categoryId: string | null;
  subcategoryId: string | null;
};

@Injectable()
export class SellerReleasePolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveEffectivePolicy(
    tx?: Prisma.TransactionClient,
    classification: SellerReleasePolicyClassification = {},
  ): Promise<EffectiveSellerReleasePolicy> {
    return this.resolveWithClient(tx ?? this.prisma, classification);
  }

  private async resolveWithClient(
    client: QueryClient,
    classification: SellerReleasePolicyClassification,
  ): Promise<EffectiveSellerReleasePolicy> {
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

    const rules = await client.$queryRaw<MatchingRule[]>`
      SELECT "id", "code", "delayHours", "scope"::text AS "scope", "categoryId", "subcategoryId"
      FROM "SellerReleasePolicyRule"
      WHERE "policyVersionId" = ${policies[0].id}::uuid
        AND "enabled" = true
        AND (
          "scope" = 'DEFAULT'
          OR ("scope" = 'CATEGORY' AND "categoryId" = ${classification.categoryId ?? null}::uuid)
          OR ("scope" = 'SUBCATEGORY' AND "subcategoryId" = ${classification.subcategoryId ?? null}::uuid)
        )
      FOR SHARE
    `;

    const precedence: EffectiveSellerReleasePolicy['source'][] = [
      'SUBCATEGORY',
      'CATEGORY',
      'DEFAULT',
    ];
    let selected: MatchingRule | undefined;
    for (const scope of precedence) {
      const candidates = rules.filter((rule) => rule.scope === scope);
      if (candidates.length > 1)
        throw new SellerReleasePolicyError('SELLER_RELEASE_POLICY_AMBIGUOUS');
      if (candidates.length === 1) {
        selected = candidates[0];
        break;
      }
    }
    if (!selected) throw new SellerReleasePolicyError('SELLER_RELEASE_POLICY_NOT_FOUND');

    return {
      policyVersionId: policies[0].id,
      publicVersion: policies[0].publicVersion,
      ruleId: selected.id,
      ruleCode: selected.code,
      delayHours: selected.delayHours,
      source: selected.scope,
      categoryId: selected.categoryId,
      subcategoryId: selected.subcategoryId,
    };
  }
}
