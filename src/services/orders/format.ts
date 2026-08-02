import type { DisputeStatus, FulfillmentStatus, OrderStatus, PaymentStatus } from "./types";
import { parseMoneyMinor } from "./parser";
export function formatBrlMinor(value: string): string {
  const valid = parseMoneyMinor(value);
  const digits = BigInt(valid).toString().padStart(3, "0");
  const whole = digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${whole},${digits.slice(-2)}`;
}
export const orderState: Record<OrderStatus, [string, string]> = {
  PENDING_PAYMENT: [
    "Pedido criado",
    "O pedido aguarda a disponibilização ou conclusão da etapa de pagamento.",
  ],
  ACTIVE: ["Pedido ativo", "O pedido está ativo."],
  COMPLETED: ["Pedido concluído", "O pedido foi concluído."],
  CANCELLED: ["Pedido cancelado", "O pedido foi cancelado."],
  EXPIRED: ["Pedido expirado", "O prazo do pedido expirou."],
  REFUNDED: ["Pedido reembolsado", "O pedido consta como reembolsado."],
  CHARGEBACK: ["Pedido em chargeback", "O pedido consta com chargeback."],
};
export const paymentState: Record<PaymentStatus, [string, string]> = {
  NOT_CREATED: ["Pagamento não criado", "A etapa de pagamento ainda não foi disponibilizada."],
  PENDING: ["Pagamento pendente", "O pagamento está pendente."],
  PROCESSING: ["Pagamento em processamento", "O pagamento está sendo processado."],
  PAID: ["Pagamento registrado", "O pagamento consta como pago."],
  FAILED: ["Pagamento falhou", "O pagamento consta como falho."],
  EXPIRED: ["Pagamento expirado", "O pagamento expirou."],
  REFUND_PENDING: ["Reembolso pendente", "O reembolso consta como pendente."],
  PARTIALLY_REFUNDED: ["Reembolso parcial", "O pagamento consta como parcialmente reembolsado."],
  REFUNDED: ["Pagamento reembolsado", "O pagamento consta como reembolsado."],
  CHARGEBACK: ["Chargeback", "O pagamento consta com chargeback."],
};
export const fulfillmentState: Record<FulfillmentStatus, [string, string]> = {
  NOT_AVAILABLE: ["Entrega não disponível", "Entrega ainda não disponível."],
  AWAITING_SELLER: ["Aguardando seller", "A entrega aguarda o seller."],
  DELIVERED: ["Entregue", "A entrega consta como realizada."],
  AWAITING_BUYER_CONFIRMATION: [
    "Aguardando confirmação",
    "A entrega aguarda confirmação do comprador.",
  ],
  CONFIRMED: ["Entrega confirmada", "A entrega consta como confirmada."],
};
export const disputeState: Record<DisputeStatus, [string, string]> = {
  NONE: ["Sem disputa", "Não há disputa registrada."],
  OPEN: ["Disputa aberta", "Há uma disputa aberta."],
  UNDER_REVIEW: ["Disputa em análise", "A disputa está em análise."],
  RESOLVED_BUYER: [
    "Resolvida para o comprador",
    "A disputa consta como resolvida para o comprador.",
  ],
  RESOLVED_SELLER: ["Resolvida para o seller", "A disputa consta como resolvida para o seller."],
  CLOSED: ["Disputa encerrada", "A disputa está encerrada."],
};
export const formatOrderDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
