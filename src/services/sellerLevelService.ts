/**
 * sellerLevelService — mock dos níveis de vendedor (Bronze → Elite).
 *
 * Todos os benefícios, taxas e prazos são demonstrativos.
 * Cálculo definitivo depende de backend e regras operacionais.
 */
import type {
  SellerLevel,
  SellerLevelBenefit,
  SellerLevelName,
  SellerLevelProgress,
} from "@/types";

const delay = <T>(v: T, ms = 100): Promise<T> =>
  new Promise((r) => setTimeout(() => r(v), ms));

const LEVELS: SellerLevel[] = [
  {
    name: "Bronze",
    color: "text-muted-foreground",
    icon: "Medal",
    tagline: "Nível inicial. Ganhe reputação vendendo com segurança.",
    requirements: [{ label: "Vendas concluídas", value: "0+" }],
    benefits: [
      { icon: "Check", title: "Taxa padrão", description: "Plataforma cobra taxa demonstrativa base." },
      { icon: "Clock", title: "Liberação em 48h", description: "Após conclusão do pedido." },
    ],
    fee: { platformFeePercent: 10 },
    payout: { releaseHours: 48 },
  },
  {
    name: "Prata",
    color: "text-foreground",
    icon: "Award",
    tagline: "Vendedor confiável, com histórico consistente.",
    requirements: [
      { label: "Vendas concluídas", value: "30+" },
      { label: "Avaliação média", value: "4.5+" },
    ],
    benefits: [
      { icon: "Percent", title: "Pequena redução de taxa", description: "Taxa demonstrativa reduzida." },
      { icon: "Clock", title: "Liberação em 36h", description: "Prazo demonstrativo menor." },
    ],
    fee: { platformFeePercent: 9 },
    payout: { releaseHours: 36 },
  },
  {
    name: "Ouro",
    color: "text-warning",
    icon: "Crown",
    tagline: "Destaque de reputação e prioridade em suporte.",
    requirements: [
      { label: "Vendas concluídas", value: "100+" },
      { label: "Avaliação média", value: "4.7+" },
      { label: "Taxa de disputa", value: "< 2%" },
    ],
    benefits: [
      { icon: "Percent", title: "Taxa melhor", description: "Redução demonstrativa maior." },
      { icon: "Clock", title: "Liberação em 24h", description: "Repasse mais rápido." },
      { icon: "Sparkles", title: "Selo Ouro", description: "Selo público na loja." },
    ],
    fee: { platformFeePercent: 8 },
    payout: { releaseHours: 24 },
  },
  {
    name: "Diamante",
    color: "text-primary",
    icon: "Gem",
    tagline: "Reputação elevada, suporte prioritário e saque rápido.",
    requirements: [
      { label: "Vendas concluídas", value: "300+" },
      { label: "Avaliação média", value: "4.8+" },
      { label: "Taxa de disputa", value: "< 1%" },
      { label: "Entregas no prazo", value: "> 98%" },
    ],
    benefits: [
      { icon: "Percent", title: "Taxa reduzida", description: "Uma das menores da plataforma." },
      { icon: "Clock", title: "Liberação em 18h", description: "Repasse acelerado." },
      { icon: "Headphones", title: "Suporte prioritário", description: "Atendimento antes da fila." },
    ],
    fee: { platformFeePercent: 7 },
    payout: { releaseHours: 18 },
  },
  {
    name: "Elite",
    color: "text-accent",
    icon: "Trophy",
    tagline: "Máxima confiança. Reputação de referência no marketplace.",
    requirements: [
      { label: "Vendas concluídas", value: "1000+" },
      { label: "Avaliação média", value: "4.9+" },
      { label: "Taxa de disputa", value: "< 0.5%" },
      { label: "Entregas no prazo", value: "> 99%" },
    ],
    benefits: [
      { icon: "Percent", title: "Melhor taxa", description: "Menor taxa demonstrativa disponível." },
      { icon: "Clock", title: "Liberação em 12h", description: "Repasse ultra rápido." },
      { icon: "ShieldCheck", title: "Destaque máximo", description: "Selo Elite em toda a plataforma." },
    ],
    fee: { platformFeePercent: 6 },
    payout: { releaseHours: 12 },
  },
];

const mockProgress: SellerLevelProgress = {
  current: "Ouro",
  next: "Diamante",
  completedSales: 187,
  positiveReviews: 96,
  disputeRate: 0.8,
  responseTime: "< 5 min",
  onTimeRate: 98.4,
  progressToNext: 62,
};

const faq = [
  { q: "Meu nível reduz taxas?", a: "Sim, de forma demonstrativa. Níveis maiores têm taxas menores no MVP." },
  { q: "Como subo de nível?", a: "Aumentando vendas concluídas, mantendo boa avaliação e baixa taxa de disputa." },
  { q: "Meu nível pode cair?", a: "Sim. Reputação baixa, disputas ou atrasos reduzem o nível." },
];

export const sellerLevelService = {
  getSellerLevels: (): Promise<SellerLevel[]> => delay(LEVELS),
  getSellerLevelByName: (name: SellerLevelName): Promise<SellerLevel | undefined> =>
    delay(LEVELS.find((l) => l.name === name)),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getSellerLevelBySellerId: (_sellerId: string): Promise<SellerLevel> =>
    delay(LEVELS.find((l) => l.name === mockProgress.current) ?? LEVELS[0]),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getSellerLevelProgress: (_sellerId: string): Promise<SellerLevelProgress> =>
    delay(mockProgress),
  getSellerLevelBenefits: (name: SellerLevelName): Promise<SellerLevelBenefit[]> =>
    delay(LEVELS.find((l) => l.name === name)?.benefits ?? []),
  getSellerLevelRules: () =>
    delay([
      "Nível é calculado por reputação, vendas e disputas.",
      "Níveis maiores oferecem taxa e prazo demonstrativos melhores.",
      "Regras finais serão definidas com backend e operação real.",
    ]),
  getSellerLevelFaq: () => delay(faq),
};
