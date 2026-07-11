import { products } from "@/data/products";
import type {
  DigitalDelivery,
  Dispute,
  MediationCase,
  Order,
  OrderItem,
  OrderReview,
  OrderStatus,
  OrderTimelineEvent,
  ReviewDraft,
  SaleDeliveryMode,
  SaleDeliveryStatus,
  MediationStatus,
} from "@/types";


/**
 * orderService — camada mockada de pedidos (pós-compra).
 *
 * Nenhuma página deve consumir `@/data/*` diretamente para pedidos.
 * Toda a rota /pedidos/$id deve passar por aqui.
 *
 * NOTA: nenhum pedido real é criado, salvo ou entregue.
 * Substituição futura por API/backend deve preservar as assinaturas.
 */

const delay = <T,>(data: T, ms = 220): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

const STATUS_POOL: OrderStatus[] = [
  "completed",
  "awaiting_buyer_confirmation",
  "delivered_by_seller",
  "pending_payment",
  "cancelled",
];

function buildOrder(index: number): Order {
  const p = products[index % products.length]!;
  const status = STATUS_POOL[index % STATUS_POOL.length]!;
  const createdAt = new Date(Date.now() - index * 1000 * 60 * 60 * 32).toISOString();
  const item: OrderItem = {
    id: `oi-${index + 1}`,
    productId: p.id,
    productSlug: p.slug,
    productTitle: p.title,
    productImage: p.imageUrl,
    quantity: 1,
    unitPrice: p.price,
    subtotal: p.price,
  };

  const delivery: DigitalDelivery = {
    status:
      status === "completed" || status === "awaiting_buyer_confirmation"
        ? "delivered"
        : status === "delivered_by_seller"
          ? "delivered"
          : status === "pending_payment"
            ? "pending"
            : status === "cancelled"
              ? "failed"
              : "in_progress",
    method: p.instantDelivery ? "auto" : "manual",
    instructions:
      "As credenciais/códigos são liberados após confirmação de pagamento. Dados sensíveis reais só serão exibidos com backend seguro.",
    maskedPayload: "•••• •••• •••• ••••",
    deliveredAt:
      status === "completed" || status === "awaiting_buyer_confirmation"
        ? new Date(Date.now() - index * 1000 * 60 * 60 * 30).toISOString()
        : undefined,
  };

  const dispute: Dispute | undefined =
    status === "cancelled"
      ? undefined
      : index === 3
        ? {
            id: `disp-${index + 1}`,
            orderId: `order-${index + 1}`,
            status: "open",
            reason: "produto_nao_recebido",
            description:
              "Não recebi o código após confirmar o pagamento. Aguardo posição do vendedor.",
            openedAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
            updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
          }
        : undefined;

  const review: OrderReview | undefined =
    status === "completed"
      ? {
          id: `rev-${index + 1}`,
          orderId: `order-${index + 1}`,
          productRating: 5,
          sellerRating: 5,
          comment: "Entrega rápida, vendedor atencioso. Recomendo!",
          submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        }
      : undefined;

  return {
    id: `order-${index + 1}`,
    code: `LIT-${(102345 + index).toString()}`,
    status,
    createdAt,
    updatedAt: new Date().toISOString(),
    total: p.price,
    paymentMethod: index % 2 === 0 ? "PIX" : "Cartão de crédito",
    buyer: {
      id: "buyer-me",
      name: "Você",
      email: "voce@exemplo.com",
    },
    seller: {
      id: p.seller?.id ?? "seller-lit",
      name: p.seller?.name ?? "Vendedor LIT",
      slug: p.seller?.slug,
      avatarUrl: p.seller?.avatarUrl,
      verified: p.seller?.verified,
    },
    items: [item],
    delivery,
    dispute,
    review,
    // Sprint 18.9 — mock: alguns pedidos exibem Proteção LIT ativa.
    litProtection:
      index % 2 === 0
        ? {
            active: true,
            expiresAt: new Date(
              new Date(createdAt).getTime() + 90 * 24 * 3600_000,
            ).toISOString(),
          }
        : undefined,
  };
}

const ORDERS: Order[] = Array.from({ length: 5 }, (_, i) => buildOrder(i));

function timelineFor(order: Order): OrderTimelineEvent[] {
  const base = new Date(order.createdAt).getTime();
  const t = (offsetH: number) => new Date(base + offsetH * 3600_000).toISOString();

  const events: OrderTimelineEvent[] = [
    { id: "e1", kind: "created", label: "Pedido criado", at: t(0) },
    {
      id: "e2",
      kind: "paid",
      label: "Pagamento confirmado",
      at: t(0.05),
      pending: order.status === "pending_payment",
    },
    {
      id: "e3",
      kind: "seller_notified",
      label: "Vendedor notificado",
      at: t(0.1),
      pending: order.status === "pending_payment",
    },
    {
      id: "e4",
      kind: "delivery_started",
      label: "Entrega iniciada",
      at: t(0.2),
      pending:
        order.status === "pending_payment" || order.status === "paid",
    },
    {
      id: "e5",
      kind: "delivered",
      label: "Produto entregue pelo vendedor",
      at: t(0.4),
      pending: [
        "pending_payment",
        "paid",
        "awaiting_seller_delivery",
      ].includes(order.status),
    },
    {
      id: "e6",
      kind: "buyer_confirmed",
      label: "Comprador confirmou recebimento",
      at: t(1),
      pending: order.status !== "completed",
    },
    {
      id: "e7",
      kind: "completed",
      label: "Pedido concluído — pagamento liberado ao vendedor",
      at: t(1.1),
      pending: order.status !== "completed",
    },
  ];

  if (order.status === "cancelled") {
    return [
      events[0]!,
      {
        id: "ec",
        kind: "cancelled",
        label: "Pedido cancelado",
        at: t(0.3),
      },
    ];
  }

  if (order.dispute && order.dispute.status !== "none") {
    events.push({
      id: "ed",
      kind: "dispute_opened",
      label: "Disputa aberta",
      description: order.dispute.reason,
      at: order.dispute.openedAt ?? t(0.5),
    });
  }

  return events;
}

export const orderService = {
  getBuyerOrders: (): Promise<Order[]> => delay(ORDERS),

  getOrderById: (orderId: string): Promise<Order | undefined> =>
    delay(ORDERS.find((o) => o.id === orderId || o.code === orderId)),

  async getOrderTimeline(orderId: string): Promise<OrderTimelineEvent[]> {
    const order = await this.getOrderById(orderId);
    return order ? timelineFor(order) : [];
  },

  async getOrderDelivery(orderId: string): Promise<DigitalDelivery | null> {
    const order = await this.getOrderById(orderId);
    return order?.delivery ?? null;
  },

  async getOrderDispute(orderId: string): Promise<Dispute | null> {
    const order = await this.getOrderById(orderId);
    return order?.dispute ?? null;
  },

  async getOrderReview(orderId: string): Promise<OrderReview | null> {
    const order = await this.getOrderById(orderId);
    return order?.review ?? null;
  },

  /** Ações mockadas — não persistem nada. Apenas simulam o retorno. */
  simulateConfirmDelivery(orderId: string): Promise<{ ok: true; orderId: string }> {
    return delay({ ok: true, orderId });
  },

  simulateOpenDispute(
    orderId: string,
    payload: { reason: string; description: string },
  ): Promise<{ ok: true; orderId: string; reason: string }> {
    return delay({ ok: true, orderId, reason: payload.reason });
  },

  simulateSubmitReview(
    orderId: string,
    payload: ReviewDraft,
  ): Promise<{ ok: true; orderId: string; rating: number }> {
    return delay({
      ok: true,
      orderId,
      rating: (payload.productRating + payload.sellerRating) / 2,
    });
  },
};
