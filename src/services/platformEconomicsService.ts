/**
 * platformEconomicsService — mock centralizado de tarifas, prazos e planos.
 *
 * Nenhum valor aqui é vinculante. Cálculo real e cobrança
 * dependem de backend, contratos e regras jurídicas.
 */
import type {
  LitMaxBenefit,
  PaymentMethodFee,
  PayoutReleaseRule,
  PromotionTierPricing,
} from "@/types";

const delay = <T>(v: T, ms = 80): Promise<T> =>
  new Promise((r) => setTimeout(() => r(v), ms));

const promotionTiers: PromotionTierPricing[] = [
  {
    tier: "Prata",
    description: "Visibilidade padrão em busca e categorias.",
    visibility: "Aparece em resultados e categorias.",
    feeHint: "Taxa demonstrativa menor.",
  },
  {
    tier: "Ouro",
    description: "Destaque intermediário e prioridade moderada.",
    visibility: "Mais exposição em busca e vitrines.",
    feeHint: "Taxa demonstrativa intermediária.",
  },
  {
    tier: "Diamante",
    description: "Destaque premium com selo e prioridade superior.",
    visibility: "Maior exposição e selo premium.",
    feeHint: "Taxa demonstrativa premium.",
  },
];

const litMaxBenefits: LitMaxBenefit[] = [
  { icon: "MessageCircle", title: "Mensagem automática", description: "Resposta imediata configurada pelo vendedor." },
  { icon: "TrendingUp", title: "Exposição extra", description: "Boost demonstrativo em busca e vitrines." },
  { icon: "Percent", title: "Redução de taxa", description: "Possível taxa reduzida na fase real." },
  { icon: "Headphones", title: "Suporte prioritário", description: "Atendimento diferenciado." },
  { icon: "Bot", title: "Automações futuras", description: "Recursos avançados de operação." },
];

const paymentMethodFees: PaymentMethodFee[] = [
  { method: "Pix", fee: "Sem taxa demonstrativa", note: "Liberação após confirmação." },
  { method: "Cartão de crédito", fee: "Taxa demonstrativa por transação", note: "Parcelamento pode ter juros." },
  { method: "Boleto", fee: "Taxa demonstrativa fixa", note: "Confirmação em até 2 dias úteis." },
  { method: "Saldo LIT", fee: "Sem taxa demonstrativa" },
];

const payoutRules: PayoutReleaseRule[] = [
  { situation: "Pedido pago", behavior: "Saldo entra como pendente." },
  { situation: "Entrega confirmada", behavior: "Saldo migra para disponível conforme prazo do nível." },
  { situation: "Disputa aberta", behavior: "Saldo relacionado fica bloqueado até a decisão." },
  { situation: "Proteção LIT ativa", behavior: "Pode influenciar mediação, mas não libera saldo automaticamente." },
  { situation: "Saque", behavior: "Disponível apenas após implementação real de carteira e backend." },
];

const generalDisclaimer =
  "As tarifas e prazos exibidos neste MVP são demonstrativos e poderão ser ajustados na fase de backend e operação.";

export const platformEconomicsService = {
  getPromotionTiers: (): Promise<PromotionTierPricing[]> => delay(promotionTiers),
  getLitMaxBenefits: (): Promise<LitMaxBenefit[]> => delay(litMaxBenefits),
  getPaymentMethodFees: (): Promise<PaymentMethodFee[]> => delay(paymentMethodFees),
  getPayoutRules: (): Promise<PayoutReleaseRule[]> => delay(payoutRules),
  getDisclaimer: (): string => generalDisclaimer,
  getTaxasFaq: () =>
    delay([
      { q: "Quando recebo meu saldo?", a: "Após a conclusão do pedido, dentro do prazo do seu nível de vendedor." },
      { q: "O que é saldo pendente?", a: "Valor que ainda não migrou para o saldo disponível." },
      { q: "O que acontece em uma disputa?", a: "O saldo relacionado fica bloqueado até a mediação ser resolvida." },
      { q: "O que é LIT-MAX?", a: "Plano premium demonstrativo do vendedor, com automações e benefícios." },
      { q: "Como funcionam Prata/Ouro/Diamante?", a: "São planos de destaque do anúncio com visibilidade crescente." },
      { q: "Meu nível reduz taxas?", a: "Sim, de forma demonstrativa. Níveis maiores têm taxa menor no MVP." },
      { q: "Saques são automáticos?", a: "Não. Saque real exige backend seguro e ainda não está implementado." },
    ]),
};
