import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { OrderListQueryDto } from './orders.dto';
import { mapSellerOrder, sellerOrderReadInclude } from './seller-order-read.mapper';

@Injectable()
export class SellerOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: OrderListQueryDto) {
    const items = await this.prisma.order.findMany({
      where: { sellerProfile: { userId }, status: query.status },
      include: sellerOrderReadInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return { page: query.page, limit: query.limit, items: items.map(mapSellerOrder) };
  }

  async get(userId: string, orderCode: string) {
    const order = await this.prisma.order.findFirst({
      where: { publicCode: orderCode, sellerProfile: { userId } },
      include: sellerOrderReadInclude,
    });
    if (!order) throw new NotFoundException('Order not found');
    return mapSellerOrder(order);
  }
}
