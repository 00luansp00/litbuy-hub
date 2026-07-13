/**
 * orderSupportService — Sprint 18.18
 *
 * Helpers mockados para:
 *  - prazo de mediação (por categoria, com Proteção LIT);
 *  - mensagens automáticas do sistema no chat do pedido;
 *  - motivos de mediação e sua diferenciação de denúncia.
 *
 * NENHUM dado é persistido. NENHUM backend é chamado.
 * Substituição futura por backend deve preservar as assinaturas.
 */

import type { Order } from "@/types";

export interface OrderSupportWindow {
  /** Dias totais do prazo de mediação. */
  days: number;
  /** ISO. */
  deadlineDate: string;
  hasProtectionLit: boolean;
  /** Rótulo curto ("30 dias sem plano adicional"). */
  label: string;
  isExpired: boolean;
  categoryName: string;
}

export interface OrderSystemMessage {
  id: string;
  text: string;
  /** Rótulo curto (opcional) para agrupar visualmente. */
  tag?: string;
}

export interface MediationReasonOption {
  value: string;
  label: string;
  /** Sugere também abrir denúncia paralela. */
  suggestReport?: boolean;
  hint?: string;
}

/** Base de prazos mockados por "categoria" do pedido. */
const CATEGORY_WINDOWS: Record<
  string,
  { days: number; hasProtectionExtra: number; name: string }
> = {
  default: { days: 30, hasProtectionExtra: 30, name: "Padrão" },
  digital: { days: 15, hasProtectionExtra: 15, name: "Produto digital" },
  service: { days: 45, hasProtectionExtra: 30, name: "Serviço" },
};

/** Deriva um "categoryKey" mockado a partir do pedido. */
function categoryKeyOf(order: Order): keyof typeof CATEGORY_WINDOWS {
  if (order.deliveryMode === "automatic") return "digital";
  if (order.items?.[0]?.productTitle?.toLowerCase().includes("serviço"))
    return "service";
  return "default";
}

export function getMediationDeadline(order: Order): OrderSupportWindow {
  const key = categoryKeyOf(order);
  const base = CATEGORY_WINDOWS[key]!;
  const hasProtection = Boolean(
    order.protectionLitActive || order.litProtection?.active,
  );
  const days = base.days + (hasProtection ? base.hasProtectionExtra : 0);
  const created = new Date(order.createdAt).getTime();
  const deadline = new Date(created + days * 24 * 3600_000);
  const isExpired = Date.now() > deadline.getTime();
  const label = hasProtection
    ? `${days} dias com Proteção LIT`
    : `${days} dias sem plano adicional`;
  return {
    days,
    deadlineDate: deadline.toISOString(),
    hasProtectionLit: hasProtection,
    label,
    isExpired,
    categoryName: base.name,
  };
}

export function getOrderSupportWindow(order: Order): OrderSupportWindow {
  return getMediationDeadline(order);
}

/**
 * Constrói a lista mockada de avisos do sistema para o chat do pedido.
 * Nenhum destes avisos vem de backend — são derivados do próprio pedido.
 */
export function getOrderSystemMessages(order: Order): OrderSystemMessage[] {
  const hasProtection = Boolean(
    order.protectionLitActive || order.litProtection?.active,
  );
  const isAutomatic = order.deliveryMode === "automatic";
  const messages: OrderSystemMessage[] = [
    {
      id: "sys-responsibility",
      tag: "Sistema",
      text: "Este produto/serviço é de propriedade e responsabilidade do vendedor. A LIT Buy atua como intermediadora da transação e poderá liberar o pagamento ao vendedor conforme as regras de prazo e conclusão do pedido.",
    },
    {
      id: "sys-escrow",
      tag: "Sistema",
      text: "O saldo desta venda ficará pendente até confirmação do comprador ou encerramento do prazo de mediação.",
    },
    {
      id: "sys-anti-poaching",
      tag: "Sistema",
      text: "Mantenha toda a comunicação dentro da LIT Buy. Contatos externos podem reduzir sua proteção.",
    },
  ];
  if (isAutomatic) {
    messages.push({
      id: "sys-auto-delivery",
      tag: "Sistema",
      text: "Entrega automática liberada em modo demonstração.",
    });
  }
  if (hasProtection) {
    messages.push({
      id: "sys-protection",
      tag: "Sistema",
      text: "Proteção LIT ativa neste pedido. A mediação terá prioridade visual em modo demonstração.",
    });
  }
  return messages;
}

export const MEDIATION_REASONS: MediationReasonOption[] = [
  { value: "not_received", label: "Não recebi o produto" },
  { value: "different_from_listing", label: "Produto diferente do anunciado" },
  { value: "invalid_credentials", label: "Dados inválidos" },
  { value: "account_recovered", label: "Conta recuperada" },
  {
    value: "auto_delivery_failed",
    label: "Entrega automática não funcionou",
  },
  {
    value: "external_contact",
    label: "Vendedor pediu contato externo",
    suggestReport: true,
    hint: "Além da mediação, você também pode enviar uma denúncia para moderação.",
  },
  {
    value: "buyer_suspicious",
    label: "Comprador agiu de forma suspeita",
    suggestReport: true,
  },
  { value: "other", label: "Outro problema" },
];

export const orderSupportService = {
  getMediationDeadline,
  getOrderSupportWindow,
  getOrderSystemMessages,
  MEDIATION_REASONS,
};
