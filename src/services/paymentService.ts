import type {
  BuyerProfile,
  CartItem,
  CartSummary,
  CheckoutProtectionPlan,
  LitPointsCheckoutPreview,
  MockWalletBalance,
  PaymentIntent,
  PaymentMethod,
  PaymentMethodId,
  PaymentOperationalFee,
  PaymentPendingDetails,
  PaymentStatus,
  PaymentSummary,
} from "@/types";

/**
 * paymentService — Sprint 18.9
 *
 * Camada 100% mockada para métodos de pagamento, Proteção LIT,
 * LIT Points e "geração" de pagamentos pendentes.
 *
 * NENHUMA cobrança real é feita. Nenhum QR Code real é gerado.
 * Nenhum boleto real é emitido. Nenhum cartão real é processado.
 * Saldo LIT e LIT Points são visuais — nenhum débito real ocorre.
 *
 * Estado in-memory: os pagamentos "gerados" ficam num Map local
 * durante a sessão do JS runtime; nada é persistido.
 */

const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: "pix",
    label: "Pix",
    description: "Pagamento instantâneo demonstrativo (nenhum QR real).",
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
    description: "Use o saldo demonstrativo da sua carteira LIT.",
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

const PROTECTION_PLANS: CheckoutProtectionPlan[] = [
  {
    id: "standard",
    name: "Proteção padrão",
    tagline: "Inclusa em todos os pedidos.",
    extraFeePct: 0,
    benefits: [
      "Intermediação da LIT Buy",
      "Cobertura básica dentro do prazo padrão",
      "Suporte por chamado de disputa",
    ],
  },
  {
    id: "lit_protection",
    name: "Proteção LIT",
    tagline: "Mais segurança para contas digitais.",
    extraFeePct: 0.15,
    recommendedFor: ["account"],
    benefits: [
      "Cobertura estendida por 3 meses para recuperação de conta",
      "Prioridade na mediação de disputas",
      "Suporte prioritário via canal dedicado",
      "Recomendado para produtos do tipo Conta",
    ],
  },
];

const MOCK_WALLET_BALANCE: MockWalletBalance = { balance: 428.9, currency: "BRL" };
const MOCK_LIT_POINTS_BALANCE = 2450;
const LIT_POINTS_QUOTE_BRL = 0.02; // 1 point ~ R$ 0,02
const LIT_POINTS_PER_BRL = 4; // ganha 4 pontos por BRL gasto

const PAYMENTS: Map<string, PaymentIntent> = new Map();
const delay = <T,>(v: T, ms = 350): Promise<T> =>
  new Promise((r) => setTimeout(() => r(v), ms));

function getPaymentMethods(): PaymentMethod[] {
  return PAYMENT_METHODS;
}
function getPaymentMethod(id: PaymentMethodId): PaymentMethod | undefined {
  return PAYMENT_METHODS.find((m) => m.id === id);
}
function getProtectionPlans(): CheckoutProtectionPlan[] {
  return PROTECTION_PLANS;
}

function getMockWalletBalance(): MockWalletBalance {
  return MOCK_WALLET_BALANCE;
}
function getMockLitPointsBalance(): number {
  return MOCK_LIT_POINTS_BALANCE;
}

function calculateProtectionFee(subtotal: number, enabled: boolean): number {
  if (!enabled) return 0;
  return Math.max(0, subtotal) * 0.15;
}

function calculateOperationalFee(
  method: PaymentMethodId | undefined,
  total: number,
): PaymentOperationalFee {
  if (!method) return { method: "pix", amount: 0, label: "" };
  switch (method) {
    case "boleto":
      return { method, amount: 3.5, label: "Taxa operacional do boleto" };
    case "credit_card":
      return {
        method,
        amount: +(total * 0.0299).toFixed(2),
        label: "Taxa demonstrativa do cartão",
      };
    default:
      return { method, amount: 0, label: "" };
  }
}

function calculateLitPointsEarned(total: number, protectionEnabled: boolean): number {
  const base = Math.floor(Math.max(0, total) * LIT_POINTS_PER_BRL);
  const bonus = protectionEnabled ? Math.floor(base * 0.1) : 0;
  return base + bonus;
}

function calculateLitPointsRequired(total: number): number {
  if (total <= 0) return 0;
  return Math.ceil(total / LIT_POINTS_QUOTE_BRL);
}

function buildLitPointsPreview(
  total: number,
  protectionEnabled: boolean,
): LitPointsCheckoutPreview {
  const earned = calculateLitPointsEarned(total, protectionEnabled);
  const base = Math.floor(Math.max(0, total) * LIT_POINTS_PER_BRL);
  return {
    balance: MOCK_LIT_POINTS_BALANCE,
    earned,
    bonusFromProtection: earned - base,
    quote: LIT_POINTS_QUOTE_BRL,
    requiredForOrder: calculateLitPointsRequired(total),
  };
}

function buildPaymentSummary(
  cart: CartSummary,
  method: PaymentMethodId | undefined,
  protectionEnabled: boolean,
): PaymentSummary {
  const protectionFee = calculateProtectionFee(cart.subtotal, protectionEnabled);
  const totalBeforeFee = Math.max(
    0,
    cart.subtotal - cart.discount + protectionFee,
  );
  const op = calculateOperationalFee(method, totalBeforeFee);
  const total = totalBeforeFee + op.amount;
  return {
    subtotal: cart.subtotal,
    discount: cart.discount,
    protectionFee,
    operationalFee: op.amount,
    total,
    litPointsEarned: calculateLitPointsEarned(total, protectionEnabled),
  };
}

function fakeExpiration(hours: number): string {
  return new Date(Date.now() + hours * 3600_000).toISOString();
}

function randomCode(n = 6): string {
  return Math.random().toString(36).slice(2, 2 + n).toUpperCase();
}

function buildFakeDetails(method: PaymentMethodId, total: number): PaymentPendingDetails {
  switch (method) {
    case "pix":
      return {
        pixCode:
          `00020126360014BR.GOV.BCB.PIX0114+55DEMOLITBUY52040000530398654${total
            .toFixed(2)
            .replace(".", "")}5802BR5910LITBUYDEMO6009SAOPAULO62070503***6304${randomCode(4)}`,
      };
    case "boleto":
      return {
        boletoLine:
          `34191.79001 01043.510047 91020.150008 ${randomCode(1)} 9${randomCode(4)}0000${Math.floor(
            total * 100,
          )
            .toString()
            .padStart(10, "0")}`,
        boletoBarcode: `${randomCode(4)}${randomCode(4)}${randomCode(4)}${randomCode(4)}`,
      };
    case "credit_card":
      return { cardLast4: "0000", installments: 1 };
    case "lit_balance":
      return { litBalanceUsed: total };
    case "lit_points":
      return { litPointsUsed: calculateLitPointsRequired(total) };
    default:
      return {};
  }
}

interface SimulateCreatePaymentPayload {
  items: CartItem[];
  cartSummary: CartSummary;
  buyer: BuyerProfile;
  method: PaymentMethodId;
  protectionEnabled: boolean;
  installments?: number;
}

async function simulateCreatePayment(
  payload: SimulateCreatePaymentPayload,
): Promise<PaymentIntent> {
  const summary = buildPaymentSummary(
    payload.cartSummary,
    payload.method,
    payload.protectionEnabled,
  );
  const method = getPaymentMethod(payload.method);
  const details = buildFakeDetails(payload.method, summary.total);
  if (payload.installments && payload.method === "credit_card") {
    details.installments = payload.installments;
  }
  const now = new Date();
  const id = `PAY-${now.getFullYear()}-${randomCode(6)}`;
  let status: PaymentStatus = "pending";
  let expiresAt: string | undefined;
  if (payload.method === "pix") expiresAt = fakeExpiration(0.5);
  if (payload.method === "boleto") expiresAt = fakeExpiration(72);
  if (payload.method === "credit_card") status = "processing";
  if (payload.method === "lit_balance" || payload.method === "lit_points") {
    status = "approved";
  }

  const intent: PaymentIntent = {
    id,
    orderCode: `LIT-${randomCode(6)}`,
    method: payload.method,
    methodLabel: method?.label ?? "Pagamento",
    status,
    amount: summary.total,
    createdAt: now.toISOString(),
    expiresAt,
    items: payload.items,
    summary,
    buyer: payload.buyer,
    protectionEnabled: payload.protectionEnabled,
    details,
  };
  PAYMENTS.set(id, intent);
  return delay(intent);
}

async function getMockPaymentById(id: string): Promise<PaymentIntent | undefined> {
  return delay(PAYMENTS.get(id));
}

export const paymentService = {
  getPaymentMethods,
  getPaymentMethod,
  getProtectionPlans,
  getMockWalletBalance,
  getMockLitPointsBalance,
  calculateProtectionFee,
  calculateOperationalFee,
  calculateLitPointsEarned,
  calculateLitPointsRequired,
  buildLitPointsPreview,
  buildPaymentSummary,
  simulateCreatePayment,
  getMockPaymentById,
};
