import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { FinancialLedgerService } from './financial-ledger.service';
import { SellerFinanceActivityQueryDto } from './seller-finance.dto';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const keys: Record<string, keyof Movements> = {
  SELLER_PENDING: 'pendingMinor',
  SELLER_HELD: 'heldMinor',
  SELLER_AVAILABLE: 'availableMinor',
  SELLER_RESERVED: 'reservedMinor',
  SELLER_DEFICIT: 'deficitMinor',
};
type Movements = {
  pendingMinor: bigint;
  heldMinor: bigint;
  availableMinor: bigint;
  reservedMinor: bigint;
  deficitMinor: bigint;
};

@Injectable()
export class SellerFinanceReadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: FinancialLedgerService,
  ) {}

  private async seller(userId: string) {
    const seller = await this.prisma.sellerProfile.findFirst({
      where: { userId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!seller) throw new NotFoundException('Active seller profile not found');
    return seller;
  }

  async summary(userId: string) {
    const seller = await this.seller(userId);
    const b = await this.ledger.getSellerFinancialBalance(seller.id);
    return {
      currency: b.currency,
      balances: {
        pendingMinor: b.pending.toString(),
        heldMinor: b.held.toString(),
        availableMinor: b.available.toString(),
        reservedMinor: b.reserved.toString(),
        deficitMinor: b.deficit.toString(),
      },
    };
  }

  async activity(userId: string, query: SellerFinanceActivityQueryDto) {
    const seller = await this.seller(userId);
    let cursor: { createdAt: string; id: string } | undefined;
    if (query.cursor) {
      try {
        cursor = JSON.parse(Buffer.from(query.cursor, 'base64url').toString()) as typeof cursor;
        if (
          !cursor?.id ||
          !UUID_V4.test(cursor.id) ||
          !cursor.createdAt ||
          Number.isNaN(new Date(cursor.createdAt).valueOf())
        )
          throw new Error('invalid');
      } catch {
        throw new BadRequestException('Invalid cursor');
      }
    }
    const rows = await this.prisma.ledgerTransaction.findMany({
      where: {
        entries: {
          some: { account: { sellerProfileId: seller.id, ownerType: 'SELLER', currency: 'BRL' } },
        },
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(cursor.createdAt) } },
                { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      select: {
        id: true,
        type: true,
        referenceType: true,
        referenceId: true,
        createdAt: true,
        currency: true,
        entries: {
          where: { account: { sellerProfileId: seller.id, ownerType: 'SELLER', currency: 'BRL' } },
          select: {
            direction: true,
            amountMinor: true,
            account: { select: { purpose: true, accountClass: true } },
          },
        },
      },
    });
    const page = rows.slice(0, query.limit);
    const items = page.map((row) => {
      const movements: Movements = {
        pendingMinor: 0n,
        heldMinor: 0n,
        availableMinor: 0n,
        reservedMinor: 0n,
        deficitMinor: 0n,
      };
      for (const entry of row.entries) {
        const key = keys[entry.account.purpose];
        if (!key) continue;
        const positive =
          entry.account.accountClass === 'LIABILITY'
            ? entry.direction === 'CREDIT'
            : entry.direction === 'DEBIT';
        movements[key] += (positive ? 1n : -1n) * entry.amountMinor;
      }
      return {
        id: row.id,
        type: row.type,
        referenceType: row.referenceType,
        referenceId: row.referenceId,
        createdAt: row.createdAt.toISOString(),
        currency: row.currency,
        movements: Object.fromEntries(
          Object.entries(movements).map(([key, value]) => [key, value.toString()]),
        ),
      };
    });
    const last = page.at(-1);
    return {
      items,
      nextCursor:
        rows.length > query.limit && last
          ? Buffer.from(
              JSON.stringify({ createdAt: last.createdAt.toISOString(), id: last.id }),
            ).toString('base64url')
          : null,
    };
  }
}
