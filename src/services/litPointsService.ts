/**
 * litPointsService — mock do programa LIT Points da LIT Buy.
 *
 * Programa próprio da LIT Buy. Nada aqui é dinheiro nem saldo sacável.
 * Todos os valores são demonstrativos e não persistem.
 */
import type {
  LitPointsBalance,
  LitPointsEarningPreview,
  LitPointsFaqItem,
  LitPointsRule,
  LitPointsTierBenefit,
  LitPointsTransaction,
  LitPointsUsageRule,
} from "@/types";

const delay = <T>(v: T, ms = 120): Promise<T> =>
  new Promise((r) => setTimeout(() => r(v), ms));

const balance: LitPointsBalance = {
  total: 1280,
  pending: 240,
  earnedThisMonth: 360,
  expiringSoon: 80,
  nextExpirationDate: "2026-12-31",
};

const history: LitPointsTransaction[] = [
  {
    id: "lp-1",
    type: "earned_purchase",
    amount: 120,
    description: "Compra confirmada — Pedido #10245",
    createdAt: "2026-07-01T14:20:00Z",
  },
  {
    id: "lp-2",
    type: "earned_review",
    amount: 30,
    description: "Avaliação de pedido concluído",
    createdAt: "2026-06-27T10:05:00Z",
  },
  {
    id: "lp-3",
    type: "earned_bonus",
    amount: 200,
    description: "Bônus de boas-vindas LIT",
    createdAt: "2026-06-15T09:00:00Z",
  },
  {
    id: "lp-4",
    type: "earned_sale",
    amount: 90,
    description: "Venda concluída — repasse de pontos",
    createdAt: "2026-06-10T18:42:00Z",
  },
  {
    id: "lp-5",
    type: "redeemed_discount",
    amount: -150,
    description: "Desconto aplicado em compra",
    createdAt: "2026-05-30T12:10:00Z",
  },
  {
    id: "lp-6",
    type: "expired",
    amount: -20,
    description: "Pontos expirados",
    createdAt: "2026-05-01T00:00:00Z",
  },
];

const rules: LitPointsRule[] = [
  {
    id: "earn-buy",
    icon: "ShoppingBag",
    title: "Compre na LIT Buy",
    description: "Ganhe pontos a cada compra confirmada no marketplace.",
  },
  {
    id: "earn-sell",
    icon: "Store",
    title: "Venda com sucesso",
    description: "Vendedores recebem pontos por vendas concluídas sem disputa.",
  },
  {
    id: "earn-review",
    icon: "Star",
    title: "Avalie pedidos",
    description: "Ao avaliar um pedido concluído você recebe pontos extras.",
  },
  {
    id: "earn-rep",
    icon: "ShieldCheck",
    title: "Boa reputação",
    description: "Mantenha nível alto de vendedor e desbloqueie bônus.",
  },
  {
    id: "earn-campaign",
    icon: "Sparkles",
    title: "Campanhas LIT",
    description: "Participe de campanhas futuras e receba pontos-bônus.",
  },
];

const usage: LitPointsUsageRule[] = [
  {
    id: "use-discount",
    icon: "Percent",
    title: "Descontos em compras",
    description: "Use pontos para reduzir o valor de compras elegíveis.",
  },
  {
    id: "use-benefits",
    icon: "Gift",
    title: "Benefícios exclusivos",
    description: "Trocas por vantagens dentro da LIT Buy.",
  },
  {
    id: "use-campaign",
    icon: "Rocket",
    title: "Campanhas promocionais",
    description: "Multiplicadores e resgates em ações da plataforma.",
  },
];

const tierBenefits: LitPointsTierBenefit[] = [
  { level: "Bronze", multiplier: 1, description: "Ganho padrão de pontos." },
  { level: "Prata", multiplier: 1.1, description: "10% a mais em pontos ganhos." },
  { level: "Ouro", multiplier: 1.25, description: "25% a mais e bônus mensal." },
  { level: "Diamante", multiplier: 1.5, description: "50% a mais e campanhas exclusivas." },
  { level: "Elite", multiplier: 2, description: "Ganho dobrado e prioridade em campanhas." },
];

const faq: LitPointsFaqItem[] = [
  {
    q: "LIT Points são dinheiro?",
    a: "Não. LIT Points são pontos de recompensa demonstrativos e não podem ser convertidos em dinheiro.",
  },
  {
    q: "Posso sacar meus LIT Points?",
    a: "Não. Pontos não são saldo financeiro e não podem ser sacados.",
  },
  {
    q: "Como eu ganho pontos?",
    a: "Comprando, vendendo com sucesso, avaliando pedidos e participando de campanhas da LIT Buy.",
  },
  {
    q: "Como eu uso pontos?",
    a: "Em descontos, benefícios e campanhas promocionais dentro da plataforma.",
  },
  {
    q: "Os pontos expiram?",
    a: "Sim, conforme regras da plataforma. Este MVP mostra valores demonstrativos.",
  },
  {
    q: "Pontos podem ser cancelados?",
    a: "Sim, em caso de disputa, chargeback ou violação das regras do marketplace.",
  },
];

export const litPointsService = {
  getLitPointsBalance: (): Promise<LitPointsBalance> => delay(balance),
  getLitPointsHistory: (): Promise<LitPointsTransaction[]> => delay(history),
  getLitPointsRules: (): Promise<LitPointsRule[]> => delay(rules),
  getLitPointsUsageRules: (): Promise<LitPointsUsageRule[]> => delay(usage),
  getLitPointsTierBenefits: (): Promise<LitPointsTierBenefit[]> => delay(tierBenefits),
  getLitPointsFaq: (): Promise<LitPointsFaqItem[]> => delay(faq),
  getLitPointsEarningPreview: (amount: number): Promise<LitPointsEarningPreview> =>
    delay({
      purchaseAmount: amount,
      basePoints: Math.floor(amount),
      bonusPoints: Math.floor(amount * 0.1),
      totalPoints: Math.floor(amount * 1.1),
      tierMultiplier: 1.1,
    }),
  simulateRedeemPoints: (): Promise<{ ok: boolean }> => delay({ ok: true }),
  simulateEarnPoints: (): Promise<{ ok: boolean }> => delay({ ok: true }),
};
