import { Injectable } from '@nestjs/common';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { AppError } from '../common/errors/app-error';
import { acquireAdvisoryTransactionLock } from '../database/advisory-lock';
import { PrismaService } from '../database/prisma.service';
import type {
  OrderChatListQueryDto,
  OrderChatMessagesQueryDto,
  SendOrderChatMessageDto,
} from './order-chat.dto';

const eligible: Prisma.OrderWhereInput = {
  status: { in: [OrderStatus.ACTIVE, OrderStatus.COMPLETED] },
  paymentStatus: PaymentStatus.PAID,
};
const participant = (userId: string): Prisma.OrderWhereInput => ({
  OR: [{ buyerUserId: userId }, { sellerProfile: { userId } }],
});

@Injectable()
export class OrderChatService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: OrderChatListQueryDto) {
    const orders = await this.prisma.order.findMany({
      where: { ...eligible, ...participant(userId) },
      select: {
        publicCode: true,
        status: true,
        paymentStatus: true,
        chatConversation: {
          select: {
            createdAt: true,
            lastMessageAt: true,
            messages: {
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              take: 1,
              select: {
                id: true,
                clientMessageId: true,
                senderUserId: true,
                body: true,
                createdAt: true,
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return {
      page: query.page,
      limit: query.limit,
      items: orders.map((order) => this.thread(order, userId)),
    };
  }

  async detail(userId: string, orderCode: string) {
    const order = await this.ownedOrder(userId, orderCode);
    this.assertEligible(order);
    return this.thread(order, userId);
  }

  async messages(userId: string, orderCode: string, query: OrderChatMessagesQueryDto) {
    const order = await this.ownedOrder(userId, orderCode);
    this.assertEligible(order);
    if (!order.chatConversation) return { items: [], nextCursor: null };
    if (query.cursor) {
      const cursor = await this.prisma.orderChatMessage.findFirst({
        where: { id: query.cursor, conversationId: order.chatConversation.id },
        select: { id: true },
      });
      if (!cursor) this.fail('ORDER_CHAT_CURSOR_INVALID', 400);
    }
    const rows = await this.prisma.orderChatMessage.findMany({
      where: { conversationId: order.chatConversation.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: query.limit + 1,
    });
    const hasMore = rows.length > query.limit;
    const items = rows.slice(0, query.limit);
    return {
      items: items.map((message) => this.message(message, userId)),
      nextCursor: hasMore ? items.at(-1)!.id : null,
    };
  }

  async send(userId: string, orderCode: string, dto: SendOrderChatMessageDto) {
    const order = await this.ownedOrder(userId, orderCode);
    this.assertEligible(order);
    if (!dto.text.trim()) this.fail('ORDER_CHAT_MESSAGE_TEXT_REQUIRED', 400);
    return this.prisma.$transaction(async (tx) => {
      await acquireAdvisoryTransactionLock(tx, `order-chat:${order.id}`);
      const conversation = await tx.orderChatConversation.upsert({
        where: { orderId: order.id },
        create: { orderId: order.id },
        update: {},
      });
      const prior = await tx.orderChatMessage.findUnique({
        where: {
          conversationId_senderUserId_clientMessageId: {
            conversationId: conversation.id,
            senderUserId: userId,
            clientMessageId: dto.clientMessageId,
          },
        },
      });
      if (prior) {
        if (prior.body !== dto.text) this.fail('ORDER_CHAT_MESSAGE_IDEMPOTENCY_CONFLICT', 409);
        return this.message(prior, userId);
      }
      const now = new Date();
      const created = await tx.orderChatMessage.create({
        data: {
          conversationId: conversation.id,
          senderUserId: userId,
          clientMessageId: dto.clientMessageId,
          body: dto.text,
          createdAt: now,
        },
      });
      await tx.orderChatConversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: now },
      });
      return this.message(created, userId);
    });
  }

  private async ownedOrder(userId: string, orderCode: string) {
    const order = await this.prisma.order.findFirst({
      where: { publicCode: orderCode, ...participant(userId) },
      select: {
        id: true,
        publicCode: true,
        status: true,
        paymentStatus: true,
        chatConversation: {
          select: {
            id: true,
            createdAt: true,
            lastMessageAt: true,
            messages: {
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              take: 1,
              select: {
                id: true,
                clientMessageId: true,
                senderUserId: true,
                body: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });
    if (!order) this.fail('ORDER_CHAT_NOT_FOUND', 404);
    return order;
  }

  private assertEligible(order: { status: OrderStatus; paymentStatus: PaymentStatus }) {
    if (
      order.paymentStatus !== PaymentStatus.PAID ||
      (order.status !== OrderStatus.ACTIVE && order.status !== OrderStatus.COMPLETED)
    )
      this.fail('ORDER_CHAT_UNAVAILABLE', 409);
  }

  private thread(
    order: {
      publicCode: string;
      status: OrderStatus;
      paymentStatus: PaymentStatus;
      chatConversation: null | {
        createdAt: Date;
        lastMessageAt: Date | null;
        messages: Array<{
          id: string;
          clientMessageId: string;
          senderUserId: string;
          body: string;
          createdAt: Date;
        }>;
      };
    },
    userId: string,
  ) {
    const last = order.chatConversation?.messages[0];
    return {
      orderCode: order.publicCode,
      orderStatus: order.status,
      paymentStatus: order.paymentStatus,
      conversationCreated: Boolean(order.chatConversation),
      lastMessageAt: order.chatConversation?.lastMessageAt ?? null,
      ...(last ? { lastMessage: this.message(last, userId) } : {}),
    };
  }

  private message(
    message: {
      id: string;
      clientMessageId: string;
      senderUserId: string;
      body: string;
      createdAt: Date;
    },
    userId: string,
  ) {
    return {
      messageId: message.id,
      clientMessageId: message.clientMessageId,
      author: message.senderUserId === userId ? 'SELF' : 'COUNTERPARTY',
      text: message.body,
      createdAt: message.createdAt,
    };
  }

  private fail(code: string, status: number): never {
    throw new AppError(code, code, status);
  }
}
