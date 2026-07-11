import type {
  BuyerProfile,
  CartSummary,
  CheckoutPayload,
  CheckoutSummary,
  MockOrder,
  PaymentMethod,
  PaymentMethodId,
} from "@/types";

/**
 * checkoutService — camada mockada de regras de checkout.
 * Todos os métodos são síncronos ou retornam Promises fictícias.
 * Nenhum pagamento, cobrança ou pedido real é criado.
 */

const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: "pix",
    label: "Pix",
    description: "Pagamento instantâneo demonstrativo.",
    icon: "QrCode",
    tag: "Instantâneo",
  },
  {
    id: "boleto",
    label: "Boleto",
    description: "Boleto demonstrativo com linha digitável fictícia.",
    icon: "FileText",
    tag: "Até 2 dias",
  },
  {
    id: "credit_card",
    label: "Cartão de crédito",
    description: "Demonstração segura — não colete nem insira cartão real.",
    icon: "CreditCard",
    tag: "Até 12x",
  },
  {
    id: "lit_balance",
    label: "Saldo LIT",
    description: "Use o saldo demonstrativo da carteira LIT.",
    icon: "Wallet",
    tag: "Instantâneo",
  },
  {
    id: "lit_points",
    label: "LIT Points",
    description: "Pagamento visual com LIT Points (cotação demonstrativa).",
    icon: "Sparkles",
    tag: "Beta",
  },
  {
    id: "external_wallet",
    label: "Cripto (em breve)",
    description: "Integração cripto disponível após backend real.",
    icon: "Smartphone",
    tag: "Em breve",
    disabled: true,
  },
];

function getPaymentMethods(): PaymentMethod[] {
  return PAYMENT_METHODS;
}

function getPaymentMethod(id: PaymentMethodId): PaymentMethod | undefined {
  return PAYMENT_METHODS.find((m) => m.id === id);
}

function getBuyerMockProfile(overrides?: Partial<BuyerProfile>): BuyerProfile {
  return {
    name: "Comprador LIT",
    email: "comprador@litbuy.com",
    verified: true,
    status: "Conta ativa",
    memberSince: new Date().toISOString(),
    ...overrides,
  };
}

function calculateCheckoutSummary(
  cartSummary: CartSummary,
  paymentMethodId?: PaymentMethodId,
): CheckoutSummary {
  return { ...cartSummary, paymentMethodId };
}

async function simulateOrderCreation(payload: CheckoutPayload): Promise<MockOrder> {
  await new Promise<void>((r) => setTimeout(r, 900));
  const method = getPaymentMethod(payload.paymentMethodId);
  const now = new Date();
  const estimated = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return {
    orderId: `LIT-${now.getFullYear()}-${rand}`,
    status: "created",
    createdAt: now.toISOString(),
    paymentMethodId: payload.paymentMethodId,
    paymentMethodLabel: method?.label ?? "Pagamento mockado",
    total: payload.summary.total,
    itemCount: payload.summary.itemCount,
    estimatedDelivery: estimated.toISOString(),
  };
}

export const checkoutService = {
  getPaymentMethods,
  getPaymentMethod,
  getBuyerMockProfile,
  calculateCheckoutSummary,
  simulateOrderCreation,
};
