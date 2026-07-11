import { products } from "@/data/products";
import { orderService } from "@/services/orderService";
import { messageService } from "@/services/messageService";
import type {
  AutomaticDeliveryPreview,
  Conversation,
  DeliveryInstruction,
  MediationCase,
  SellerSale,
  SellerSaleDetail,
  SellerSaleFinancialSummary,
  SellerSaleTimelineEvent,
} from "@/types";

/**
 * sellerSaleService — Sprint 18.13
 *
 * Camada mockada da visão do vendedor sobre uma venda.
 * Nenhum dado real é persistido. Nenhuma rota deve acessar mocks
 * diretamente — sempre consumir por este service.
 */

const delay = <T,>(data: T, ms = 220): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

const BUYER_NAMES = [
  "Lucas M.",
  "Amanda R.",
  "Diego S.",
  "Renata C.",
  "Bruno F.",
];

async function loadOrderForSale(saleId: string) {
  const orderId = saleId.replace(/^sale-/, "order-");
  return orderService.getOrderById(orderId);
}

function toSale(index: number, p: (typeof products)[number]): SellerSale {
  const id = `sale-${index + 1}`;
  const deliveryMode = p.instantDelivery ? "automatic" : "manual";
  const statusPool: SellerSale["status"][] = [
    "paid",
    "delivered",
    "completed",
    "pending",
    "refunded",
    "completed",
  ];
  return {
    id,
    code: `LIT-V${(304821 + index).toString()}`,
    orderId: `order-${index + 1}`,
    orderCode: `LIT-${(102345 + index).toString()}`,
    status: statusPool[index % statusPool.length]!,
    createdAt: new Date(Date.now() - index * 1000 * 60 * 60 * 26).toISOString(),
    amount: p.price,
    buyerName: BUYER_NAMES[index % BUYER_NAMES.length]!,
    buyerAvatar: `https://i.pravatar.cc/64?u=buyer-${index}`,
    productTitle: p.title,
    productImage: p.imageUrl,
    productSlug: p.slug,
    variationLabel: p.instantDelivery ? "Padrão — 1 unidade" : undefined,
    paymentMethod: index % 2 === 0 ? "PIX" : "Cartão de crédito",
    deliveryMode,
    deliveryStatus:
      deliveryMode === "automatic"
        ? "automatic_delivery_released"
        : "awaiting_seller_delivery",
    hasAutomaticMessage: index % 2 === 0,
    protectionLitActive: index % 2 === 0,
    mediationStatus: index === 3 ? "under_review" : "none",
    sellerPlan: index % 3 === 0 ? "ouro" : index % 3 === 1 ? "prata" : "diamante",
    litPointsEstimate: Math.round(p.price * 0.02),
  };
}

const SALES: SellerSale[] = products
  .slice(0, 6)
  .map((p, i) => toSale(i, p));

function timelineFor(sale: SellerSale): SellerSaleTimelineEvent[] {
  const base = new Date(sale.createdAt).getTime();
  const t = (h: number) => new Date(base + h * 3600_000).toISOString();
  const events: SellerSaleTimelineEvent[] = [
    { id: "st1", at: t(0), kind: "order_created", label: "Pedido criado" },
    { id: "st2", at: t(0.1), kind: "payment_approved", label: "Pagamento aprovado" },
    { id: "st3", at: t(0.15), kind: "chat_created", label: "Conversa do pedido criada" },
  ];
  if (sale.hasAutomaticMessage) {
    events.push({
      id: "st4",
      at: t(0.2),
      kind: "automatic_message_sent",
      label: "Mensagem automática enviada (LIT-MAX)",
    });
  }
  events.push({
    id: "st5",
    at: t(0.3),
    kind: "seller_notified",
    label: "Vendedor notificado",
  });
  if (sale.deliveryMode === "automatic") {
    events.push({
      id: "st6",
      at: t(0.35),
      kind: "delivery_sent",
      label: "Entrega automática liberada",
    });
  } else if (sale.status !== "pending") {
    events.push({
      id: "st6",
      at: t(0.5),
      kind: "delivery_sent",
      label: "Entrega enviada pelo vendedor",
      pending: sale.status === "paid",
    });
  }
  if (sale.status === "completed") {
    events.push({
      id: "st7",
      at: t(1),
      kind: "buyer_confirmed",
      label: "Comprador confirmou recebimento",
    });
    events.push({
      id: "st8",
      at: t(1.1),
      kind: "completed",
      label: "Pedido concluído",
    });
  }
  if (sale.mediationStatus !== "none") {
    events.push({
      id: "st9",
      at: t(0.7),
      kind: "dispute_opened",
      label: "Mediação aberta pelo comprador",
    });
    events.push({
      id: "st10",
      at: t(0.85),
      kind: "mediation_under_review",
      label: "Mediação em análise",
    });
  }
  return events;
}

function financialFor(sale: SellerSale): SellerSaleFinancialSummary {
  const platformFee = Math.round(sale.amount * 0.12 * 100) / 100;
  const litProtectionFee = sale.protectionLitActive
    ? Math.round(sale.amount * 0.03 * 100) / 100
    : 0;
  const litMaxFee = sale.hasAutomaticMessage
    ? Math.round(sale.amount * 0.01 * 100) / 100
    : 0;
  const net =
    Math.round((sale.amount - platformFee - litProtectionFee - litMaxFee) * 100) /
    100;
  const blockedInDispute =
    sale.mediationStatus !== "none" ? sale.amount : 0;
  return {
    gross: sale.amount,
    platformFee,
    planLabel: sale.sellerPlan ? `Plano ${sale.sellerPlan}` : undefined,
    litMaxFee: litMaxFee || undefined,
    litProtectionFee: litProtectionFee || undefined,
    net,
    pending: blockedInDispute ? 0 : net,
    blockedInDispute,
    expectedReleaseAt: new Date(
      Date.now() + 7 * 24 * 3600_000,
    ).toISOString(),
    sellerLevelHint:
      sale.sellerPlan === "diamante"
        ? "Nível Diamante libera saldo em D+2 (mock)."
        : "Nível padrão libera saldo em D+7 (mock).",
  };
}

function automaticDeliveryFor(
  sale: SellerSale,
): AutomaticDeliveryPreview | undefined {
  if (sale.deliveryMode !== "automatic") return undefined;
  return {
    status: "released",
    maskedPayload: "••••••••••••••A1B2",
    unitsRemaining: 8,
    unitsTotal: 10,
    releasedAt: new Date(
      new Date(sale.createdAt).getTime() + 30 * 60_000,
    ).toISOString(),
  };
}

export const sellerSaleService = {
  getSellerSales: (): Promise<SellerSale[]> => delay(SALES),

  getSellerSaleById: (saleId: string): Promise<SellerSale | undefined> =>
    delay(SALES.find((s) => s.id === saleId || s.code === saleId)),

  async getSellerSaleDetail(saleId: string): Promise<SellerSaleDetail | null> {
    const sale = await this.getSellerSaleById(saleId);
    if (!sale) return null;
    const [mediation] = await Promise.all([this.getSellerSaleMediation(saleId)]);
    const detail: SellerSaleDetail = {
      ...sale,
      timeline: timelineFor(sale),
      financial: financialFor(sale),
      automaticDelivery: automaticDeliveryFor(sale),
      deliveryInstructions: [],
      mediation: mediation ?? undefined,
    };
    return detail;
  },

  async getSellerSaleTimeline(
    saleId: string,
  ): Promise<SellerSaleTimelineEvent[]> {
    const sale = await this.getSellerSaleById(saleId);
    return sale ? timelineFor(sale) : [];
  },

  async getSellerSaleDelivery(
    saleId: string,
  ): Promise<AutomaticDeliveryPreview | null> {
    const sale = await this.getSellerSaleById(saleId);
    return sale ? automaticDeliveryFor(sale) ?? null : null;
  },

  async getSellerSaleFinancialSummary(
    saleId: string,
  ): Promise<SellerSaleFinancialSummary | null> {
    const sale = await this.getSellerSaleById(saleId);
    return sale ? financialFor(sale) : null;
  },

  async getSellerSaleConversation(saleId: string): Promise<Conversation | null> {
    return messageService.getSellerSaleConversation(saleId);
  },

  async getSellerSaleMediation(saleId: string): Promise<MediationCase | null> {
    const order = await loadOrderForSale(saleId);
    if (!order) return null;
    return orderService.getOrderMediation(order.id);
  },

  async getSellerSaleEvidence(saleId: string) {
    const m = await this.getSellerSaleMediation(saleId);
    return m?.evidence ?? [];
  },

  simulateMarkAsDelivered: (
    saleId: string,
  ): Promise<{ ok: true; saleId: string }> => delay({ ok: true, saleId }),

  simulateSendDeliveryInstructions: (
    saleId: string,
    text: string,
  ): Promise<DeliveryInstruction> =>
    delay({
      id: `di-${Date.now()}`,
      text,
      sentAt: new Date().toISOString(),
    }),

  simulateSubmitSellerResponse: (
    saleId: string,
    text: string,
  ): Promise<{ ok: true; saleId: string; text: string }> =>
    delay({ ok: true, saleId, text }),

  simulateSubmitSellerEvidence: (
    saleId: string,
    label: string,
  ): Promise<{ ok: true; saleId: string; label: string }> =>
    delay({ ok: true, saleId, label }),
};
