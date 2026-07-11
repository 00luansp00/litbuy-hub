import type {
  AffiliateCampaign,
  AffiliateCommission,
  AffiliateCommissionSummary,
  AffiliateConversion,
  AffiliateFaqItem,
  AffiliateLink,
  AffiliateMaterial,
  AffiliatePayoutPreview,
  AffiliateProfile,
  AffiliateRule,
  AffiliateStats,
} from "@/types";

/**
 * affiliateService — Sprint 18.16
 *
 * Camada 100% mockada do programa de afiliados da LIT Buy.
 * Nada aqui é real: sem tracking, sem cookies, sem persistência,
 * sem cálculo de comissão, sem saque. Nenhum componente deve
 * acessar mocks diretamente — sempre passar por este service.
 */

const delay = <T,>(data: T, ms = 160): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

const iso = (daysAgo: number): string =>
  new Date(Date.now() - daysAgo * 86_400_000).toISOString();

const PROFILE: AffiliateProfile = {
  id: "aff-1",
  displayName: "Sua conta LIT Buy",
  code: "LUAN123",
  status: "active",
  joinedAt: iso(45),
  tier: "growth",
};

const LINK: AffiliateLink = {
  url: "https://litbuy.com/?ref=LUAN123",
  shortUrl: "https://litb.uy/LUAN123",
  code: PROFILE.code,
  qrCodeLabel: "QR Code demonstrativo",
};

const STATS: AffiliateStats = {
  clicks: 1284,
  signups: 96,
  buyersConverted: 41,
  sellersReferred: 8,
  salesGenerated: 27,
  conversionRate: 0.032,
  commissionPending: 184.5,
  commissionAvailable: 312.7,
  commissionTotal: 812.3,
};

const CONVERSIONS: AffiliateConversion[] = [
  {
    id: "cv-1",
    createdAt: iso(0.2),
    type: "signup",
    referredUserMasked: "lu***@gmail.com",
    status: "confirmed",
    commissionAmount: 2.0,
    commissionStatus: "available",
  },
  {
    id: "cv-2",
    createdAt: iso(0.8),
    type: "first_purchase",
    referredUserMasked: "ma***@hotmail.com",
    status: "confirmed",
    saleAmount: 149.9,
    commissionAmount: 14.99,
    commissionStatus: "available",
  },
  {
    id: "cv-3",
    createdAt: iso(2),
    type: "first_sale",
    referredUserMasked: "pe***@outlook.com",
    status: "confirmed",
    saleAmount: 320,
    commissionAmount: 32,
    commissionStatus: "pending",
  },
  {
    id: "cv-4",
    createdAt: iso(3),
    type: "recurring_sale",
    referredUserMasked: "an***@gmail.com",
    status: "pending",
    saleAmount: 89.9,
    commissionAmount: 4.5,
    commissionStatus: "pending",
  },
  {
    id: "cv-5",
    createdAt: iso(4),
    type: "special_campaign",
    referredUserMasked: "jo***@yahoo.com",
    status: "confirmed",
    saleAmount: 199,
    commissionAmount: 19.9,
    commissionStatus: "paid",
  },
  {
    id: "cv-6",
    createdAt: iso(6),
    type: "first_purchase",
    referredUserMasked: "th***@gmail.com",
    status: "cancelled",
    saleAmount: 59,
    commissionAmount: 5.9,
    commissionStatus: "cancelled",
  },
  {
    id: "cv-7",
    createdAt: iso(9),
    type: "recurring_sale",
    referredUserMasked: "ra***@gmail.com",
    status: "reversed",
    saleAmount: 120,
    commissionAmount: 6,
    commissionStatus: "reversed",
  },
];

const COMMISSIONS: AffiliateCommission[] = [
  {
    id: "co-1",
    createdAt: iso(0.5),
    description: "Comissão — venda de indicado (mock)",
    amount: 14.99,
    status: "available",
    releaseForecast: iso(-2),
  },
  {
    id: "co-2",
    createdAt: iso(1.5),
    description: "Comissão — primeira venda de vendedor indicado",
    amount: 32,
    status: "pending",
    releaseForecast: iso(-7),
  },
  {
    id: "co-3",
    createdAt: iso(10),
    description: "Comissão paga (mock)",
    amount: 19.9,
    status: "paid",
  },
  {
    id: "co-4",
    createdAt: iso(15),
    description: "Comissão cancelada — pedido reembolsado",
    amount: 5.9,
    status: "cancelled",
  },
  {
    id: "co-5",
    createdAt: iso(20),
    description: "Comissão estornada — disputa vencida pelo comprador",
    amount: 6,
    status: "reversed",
  },
];

const COMMISSION_SUMMARY: AffiliateCommissionSummary = {
  pending: STATS.commissionPending,
  available: STATS.commissionAvailable,
  paid: 245.6,
  cancelled: 32.1,
  reversed: 12.4,
  minimumPayout: 50,
  nextForecast: iso(-7),
};

const CAMPAIGNS: AffiliateCampaign[] = [
  {
    id: "cp-1",
    title: "Convide vendedores",
    description:
      "Indique vendedores ativos e ganhe bônus na primeira venda deles.",
    period: "Contínua",
    bonusLabel: "+R$ 25 por vendedor ativado",
    status: "active",
    ctaLabel: "Convidar vendedores",
  },
  {
    id: "cp-2",
    title: "Convide compradores",
    description:
      "Compradores indicados que finalizam a primeira compra geram bônus.",
    period: "Contínua",
    bonusLabel: "+2% na 1ª compra",
    status: "active",
    ctaLabel: "Compartilhar link",
  },
  {
    id: "cp-3",
    title: "Campanha de lançamento",
    description:
      "Ganhe bônus extras em conversões durante o mês de lançamento (mock).",
    period: "01/01 – 31/01",
    bonusLabel: "Bônus 2x",
    status: "upcoming",
    ctaLabel: "Ficar por dentro",
  },
  {
    id: "cp-4",
    title: "Bônus por categoria destaque",
    description:
      "Indicações em categorias selecionadas geram comissão maior.",
    period: "Contínua",
    bonusLabel: "+50% em categorias premium",
    status: "active",
    ctaLabel: "Ver categorias",
  },
];

const MATERIALS: AffiliateMaterial[] = [
  {
    id: "mt-1",
    title: "Banner para redes sociais",
    description: "Peça visual pronta para stories e feed (demonstração).",
    type: "banner",
    previewLabel: "Prévia visual mockada",
  },
  {
    id: "mt-2",
    title: "Texto pronto para compartilhar",
    description: "Copie e cole em qualquer rede social.",
    type: "text",
    previewLabel: "Texto mock",
    copyText:
      "Conheça a LIT Buy — marketplace de produtos digitais com Proteção LIT. Use meu link: https://litbuy.com/?ref=LUAN123",
  },
  {
    id: "mt-3",
    title: "Card de convite",
    description: "Card de convite personalizado com seu código.",
    type: "invite_card",
    previewLabel: "Card demonstrativo",
  },
  {
    id: "mt-4",
    title: "Link para criadores",
    description: "Link curto para bio de criadores de conteúdo.",
    type: "creator_link",
    previewLabel: "Link curto mock",
    copyText: LINK.shortUrl,
  },
  {
    id: "mt-5",
    title: "Guia de divulgação",
    description: "Boas práticas para divulgar sem violar as regras da LIT Buy.",
    type: "guide",
    previewLabel: "Guia mock em PDF",
  },
];

const RULES: AffiliateRule[] = [
  {
    id: "r-1",
    title: "Comissão sobre indicações válidas",
    description:
      "Você recebe comissão apenas por usuários novos, ativos e que passem pelas validações da LIT Buy.",
    tone: "info",
  },
  {
    id: "r-2",
    title: "Comissão pendente até confirmação",
    description:
      "Comissões ficam pendentes até que o pedido seja confirmado e o prazo de disputa expire.",
    tone: "info",
  },
  {
    id: "r-3",
    title: "Cancelamento e estorno",
    description:
      "Pedidos cancelados, reembolsados ou perdidos em disputa cancelam a comissão vinculada.",
    tone: "warning",
  },
  {
    id: "r-4",
    title: "Autoindicação proibida",
    description:
      "Indicar a si mesmo, familiares ou contas secundárias resulta em bloqueio do afiliado.",
    tone: "danger",
  },
  {
    id: "r-5",
    title: "Spam e fraude proibidos",
    description:
      "Spam, tráfego incentivado fraudulento, cliques automatizados ou uso indevido da marca podem suspender o afiliado.",
    tone: "danger",
  },
  {
    id: "r-6",
    title: "Uso da marca LIT Buy",
    description:
      "Anúncios pagos usando a marca LIT Buy podem exigir autorização prévia.",
    tone: "warning",
  },
  {
    id: "r-7",
    title: "Comissão real depende de backend",
    description:
      "Cálculo, atribuição, saque e auditoria de comissão só existem com backend real, tracking seguro e antifraude.",
    tone: "info",
  },
];

const FAQ: AffiliateFaqItem[] = [
  {
    q: "Como funciona o programa de afiliados?",
    a: "Você recebe um link e um código exclusivos. Ao indicar usuários que se cadastram, compram ou vendem, você acumula comissão demonstrativa.",
  },
  {
    q: "Quem pode participar?",
    a: "Qualquer conta ativa da LIT Buy pode participar — compradores, vendedores ou usuários comuns.",
  },
  {
    q: "Quando a comissão fica disponível?",
    a: "A comissão fica pendente até que o pedido seja confirmado e o prazo de disputa expire (mock).",
  },
  {
    q: "Posso sacar comissão?",
    a: "Saque real exige backend financeiro, verificação de identidade e integração bancária. Nesta fase o botão de saque é apenas demonstrativo.",
  },
  {
    q: "O que acontece se o pedido for cancelado?",
    a: "Se um pedido indicado for cancelado, reembolsado ou perdido em disputa, a comissão vinculada é cancelada ou estornada.",
  },
  {
    q: "Posso indicar vendedores?",
    a: "Sim. Vendedores indicados que se tornarem ativos podem gerar bônus específicos.",
  },
  {
    q: "Posso divulgar em redes sociais?",
    a: "Sim, respeitando as regras. Anúncios pagos usando a marca LIT Buy podem exigir autorização.",
  },
  {
    q: "O que é proibido?",
    a: "Autoindicação, spam, tráfego incentivado fraudulento, cliques automatizados, múltiplas contas e uso indevido da marca são proibidos.",
  },
  {
    q: "Como acompanho minhas conversões?",
    a: "Acompanhe em /afiliados. Nesta fase todos os dados são demonstrativos.",
  },
];

const PAYOUT_PREVIEW: AffiliatePayoutPreview = {
  eligibleAmount: STATS.commissionAvailable,
  minimumPayout: 50,
  estimatedProcessingDays: 5,
  requiresKyc: true,
  note: "Saque real exigirá backend financeiro, verificação de identidade (KYC) e integração bancária. Nesta fase o botão apenas demonstra o fluxo.",
};

export const affiliateService = {
  getAffiliateProfile: (): Promise<AffiliateProfile> => delay(PROFILE),
  getAffiliateLink: (): Promise<AffiliateLink> => delay(LINK),
  getAffiliateStats: (): Promise<AffiliateStats> => delay(STATS),
  getAffiliateConversions: (): Promise<AffiliateConversion[]> =>
    delay(CONVERSIONS.slice()),
  getAffiliateCommissions: (): Promise<AffiliateCommission[]> =>
    delay(COMMISSIONS.slice()),
  getAffiliateCommissionSummary: (): Promise<AffiliateCommissionSummary> =>
    delay(COMMISSION_SUMMARY),
  getAffiliateCampaigns: (): Promise<AffiliateCampaign[]> =>
    delay(CAMPAIGNS.slice()),
  getAffiliateMaterials: (): Promise<AffiliateMaterial[]> =>
    delay(MATERIALS.slice()),
  getAffiliateRules: (): Promise<AffiliateRule[]> => delay(RULES.slice()),
  getAffiliateFaq: (): Promise<AffiliateFaqItem[]> => delay(FAQ.slice()),
  getAffiliatePayoutPreview: (): Promise<AffiliatePayoutPreview> =>
    delay(PAYOUT_PREVIEW),

  simulateCopyAffiliateLink: (): Promise<{ ok: true }> => delay({ ok: true }),
  simulateGenerateAffiliateCode: (): Promise<{ code: string }> =>
    delay({ code: `LIT${Math.floor(Math.random() * 9999)}` }),
  simulateRequestCommissionPayout: (): Promise<{ ok: true }> =>
    delay({ ok: true }),
};
