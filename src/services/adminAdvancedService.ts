import type {
  AdminAuditLogEntry,
  AdminCategoryRow,
  AdminContentPage,
  AdminFeatureFlag,
  AdminFeeConfig,
  AdminKycReview,
  AdminLitPointsConfig,
  AdminPaymentMethodRow,
  AdminPermissionDef,
  AdminPlanBenefitConfig,
  AdminReportMetric,
  AdminReportRow,
  AdminRoleDef,
  AdminSellerLevelConfigRow,
  AdminSubcategoryRow,
} from "@/types";

/**
 * adminAdvancedService — camada mockada da Sprint 18.12 (Admin Avançado).
 * Nenhuma alteração real é feita. Todas as ações do painel administrativo
 * devem ser tratadas como demonstrativas. Em produção, este service deve
 * ser substituído por endpoints protegidos com RBAC, audit log e MFA.
 */

const delay = <T,>(data: T, ms = 200): Promise<T> =>
  new Promise((r) => setTimeout(() => r(data), ms));

const categories: AdminCategoryRow[] = [
  { id: "c1", slug: "contas-gaming", name: "Contas Gaming", icon: "Gamepad2", color: "primary", active: true, featured: true, order: 1, listingsCount: 842, reports: 3, risk: "high" },
  { id: "c2", slug: "gift-cards", name: "Gift Cards", icon: "Gift", color: "accent", active: true, featured: true, order: 2, listingsCount: 512, reports: 1, risk: "medium" },
  { id: "c3", slug: "moedas-virtuais", name: "Moedas Virtuais", icon: "Coins", color: "warning", active: true, featured: false, order: 3, listingsCount: 320, reports: 4, risk: "high" },
  { id: "c4", slug: "servicos-gaming", name: "Serviços Gaming", icon: "Wrench", color: "success", active: true, featured: false, order: 4, listingsCount: 148, reports: 0, risk: "low" },
  { id: "c5", slug: "software", name: "Software", icon: "AppWindow", color: "muted", active: false, featured: false, order: 5, listingsCount: 47, reports: 0, risk: "low" },
];

const subcategories: AdminSubcategoryRow[] = [
  { id: "sc1", slug: "valorant", name: "Valorant", categoryId: "c1", active: true, listingsCount: 210 },
  { id: "sc2", slug: "league-of-legends", name: "League of Legends", categoryId: "c1", active: true, listingsCount: 189 },
  { id: "sc3", slug: "steam", name: "Steam", categoryId: "c2", active: true, listingsCount: 240 },
  { id: "sc4", slug: "psn", name: "PSN", categoryId: "c2", active: true, listingsCount: 122 },
  { id: "sc5", slug: "robux", name: "Robux", categoryId: "c3", active: true, listingsCount: 178 },
  { id: "sc6", slug: "elo-boost", name: "Elo Boost", categoryId: "c4", active: false, listingsCount: 22 },
];

const permissions: AdminPermissionDef[] = [
  { key: "catalog.manage", label: "Gerenciar categorias", group: "catalog" },
  { key: "listings.approve", label: "Aprovar anúncios", group: "listings" },
  { key: "listings.pause", label: "Pausar anúncios", group: "listings" },
  { key: "listings.remove", label: "Remover anúncios", group: "listings", sensitive: true },
  { key: "users.suspend", label: "Suspender usuários", group: "users", sensitive: true },
  { key: "kyc.review", label: "Revisar KYC", group: "kyc" },
  { key: "reports.review", label: "Revisar denúncias", group: "kyc" },
  { key: "disputes.resolve", label: "Resolver disputas", group: "kyc" },
  { key: "financial.view", label: "Ver financeiro", group: "financial", sensitive: true },
  { key: "financial.payouts", label: "Gerenciar saques", group: "financial", sensitive: true },
  { key: "financial.fees", label: "Alterar taxas", group: "financial", sensitive: true },
  { key: "payments.configure", label: "Configurar pagamentos", group: "financial", sensitive: true },
  { key: "content.edit", label: "Editar conteúdo", group: "content" },
  { key: "reports.view", label: "Acessar relatórios", group: "system" },
  { key: "audit.view", label: "Ver audit log", group: "system", sensitive: true },
  { key: "flags.toggle", label: "Alterar feature flags", group: "system", sensitive: true },
];

const ALL = permissions.map((p) => p.key);

const roles: AdminRoleDef[] = [
  { id: "r-admin", name: "Admin total", description: "Acesso completo ao painel.", active: true, permissions: ALL, members: 2 },
  { id: "r-mod-listings", name: "Moderador de anúncios", description: "Aprova, pausa e remove anúncios.", active: true, members: 4,
    permissions: ["listings.approve", "listings.pause", "listings.remove", "reports.review", "reports.view"] },
  { id: "r-mod-disputes", name: "Moderador de disputas", description: "Resolve disputas e denúncias.", active: true, members: 3,
    permissions: ["disputes.resolve", "reports.review", "reports.view"] },
  { id: "r-support", name: "Suporte", description: "Atendimento ao usuário.", active: true, members: 6,
    permissions: ["reports.view"] },
  { id: "r-finance", name: "Financeiro", description: "Gestão de saldo, saques e taxas.", active: true, members: 2,
    permissions: ["financial.view", "financial.payouts", "financial.fees", "payments.configure", "reports.view"] },
  { id: "r-content", name: "Conteúdo", description: "Edita banners, FAQs e políticas.", active: true, members: 2,
    permissions: ["content.edit", "reports.view"] },
  { id: "r-readonly", name: "Leitura apenas", description: "Acesso somente leitura ao painel.", active: false, members: 0,
    permissions: ["reports.view", "audit.view"] },
];

const kycQueue: AdminKycReview[] = [
  { id: "kyc-1", userName: "Lucas Martins", userEmail: "lucas@demo.litbuy", submittedAt: new Date(Date.now() - 6 * 3600e3).toISOString(), status: "pending_review", risk: "low", documentType: "cnh", selfieProvided: true },
  { id: "kyc-2", userName: "Amanda Rocha", userEmail: "amanda@demo.litbuy", submittedAt: new Date(Date.now() - 26 * 3600e3).toISOString(), status: "needs_more_info", risk: "medium", documentType: "rg", selfieProvided: true },
  { id: "kyc-3", userName: "Diego Sousa", userEmail: "diego@demo.litbuy", submittedAt: new Date(Date.now() - 2 * 3600e3).toISOString(), status: "pending_review", risk: "high", documentType: "passport", selfieProvided: false },
  { id: "kyc-4", userName: "Renata Cardoso", userEmail: "renata@demo.litbuy", submittedAt: new Date(Date.now() - 72 * 3600e3).toISOString(), status: "pending_review", risk: "critical", documentType: "cnh", selfieProvided: true },
];

const fees: AdminFeeConfig[] = [
  { id: "f-base", label: "Taxa base da plataforma", percent: 10, active: true, note: "Aplicada quando nenhum nível especial se aplica." },
  { id: "f-prata", label: "Nível Prata", percent: 9, active: true },
  { id: "f-ouro", label: "Nível Ouro", percent: 7.5, active: true },
  { id: "f-diamante", label: "Nível Diamante", percent: 6, active: true },
  { id: "f-litmax", label: "Assinantes LIT-MAX", percent: 5.5, active: true, note: "Combina com o nível do vendedor." },
  { id: "f-protection", label: "Proteção LIT", percent: 1.9, fixed: 0.5, active: true },
];

const paymentMethods: AdminPaymentMethodRow[] = [
  { id: "pix", name: "Pix", active: true, feePercent: 0.99, minValue: 5, maxValue: 20000, expirationHours: 24, environment: "demo" },
  { id: "boleto", name: "Boleto", active: true, feePercent: 1.9, minValue: 20, maxValue: 5000, expirationHours: 72, environment: "demo" },
  { id: "card", name: "Cartão de crédito", active: true, feePercent: 3.9, minValue: 5, maxValue: 15000, environment: "demo" },
  { id: "lit_balance", name: "Saldo LIT", active: true, feePercent: 0, minValue: 1, maxValue: 20000, environment: "demo" },
  { id: "lit_points", name: "LIT Points", active: true, feePercent: 0, minValue: 1, maxValue: 500, environment: "demo" },
  { id: "crypto", name: "Cripto (futuro)", active: false, feePercent: 1.5, minValue: 50, maxValue: 50000, environment: "future" },
];

const litPoints: AdminLitPointsConfig = {
  active: true,
  pointsPerPurchase: 10,
  pointsPerSale: 5,
  pointsPerReview: 3,
  campaignBonus: 20,
  expirationDays: 365,
  maxUsePercentPerOrder: 20,
  quote: 0.05,
};

const sellerLevels: AdminSellerLevelConfigRow[] = [
  { id: "bronze", name: "Bronze", minSales: 0, minRating: 0, maxDisputeRate: 15, platformFeePercent: 10, releaseHours: 72, priority: 1, active: true },
  { id: "prata", name: "Prata", minSales: 50, minRating: 4.2, maxDisputeRate: 8, platformFeePercent: 9, releaseHours: 48, priority: 2, active: true },
  { id: "ouro", name: "Ouro", minSales: 250, minRating: 4.5, maxDisputeRate: 4, platformFeePercent: 7.5, releaseHours: 24, priority: 3, active: true },
  { id: "diamante", name: "Diamante", minSales: 1000, minRating: 4.7, maxDisputeRate: 2, platformFeePercent: 6, releaseHours: 12, priority: 4, active: true },
  { id: "elite", name: "Elite", minSales: 5000, minRating: 4.9, maxDisputeRate: 1, platformFeePercent: 5, releaseHours: 6, priority: 5, active: false },
];

const plans: AdminPlanBenefitConfig[] = [
  { id: "lit_max", name: "LIT-MAX", active: true, priceMonthly: 49.9, benefits: ["Taxa reduzida", "Destaque em buscas", "Suporte prioritário", "Mensagem automática avançada"], searchBoost: 2 },
  { id: "prata", name: "Destaque Prata", active: true, feePercent: 4, benefits: ["Selo Prata no anúncio", "+15% de posição em buscas"], searchBoost: 1.2 },
  { id: "ouro", name: "Destaque Ouro", active: true, feePercent: 6, benefits: ["Selo Ouro", "+35% de posição em buscas", "Aparece na Home"], searchBoost: 1.6 },
  { id: "diamante", name: "Destaque Diamante", active: true, feePercent: 9, benefits: ["Selo Diamante", "Prioridade máxima", "Aparece em campanhas"], searchBoost: 2.4 },
];

const flags: AdminFeatureFlag[] = [
  { key: "create_listing", label: "Criação de anúncios", description: "Permite criar novos anúncios.", enabled: true, category: "marketplace" },
  { key: "checkout", label: "Checkout", description: "Fluxo de compra ativo.", enabled: true, category: "marketplace" },
  { key: "pay_pix", label: "Pagamento Pix", description: "Método Pix disponível.", enabled: true, category: "payment" },
  { key: "pay_boleto", label: "Pagamento Boleto", description: "Método boleto disponível.", enabled: true, category: "payment" },
  { key: "pay_card", label: "Pagamento Cartão", description: "Cartão de crédito disponível.", enabled: true, category: "payment" },
  { key: "lit_points", label: "LIT Points", description: "Programa de pontos ativo.", enabled: true, category: "growth" },
  { key: "lit_max", label: "LIT-MAX", description: "Plano premium para vendedores.", enabled: true, category: "growth" },
  { key: "affiliates", label: "Afiliados", description: "Programa de afiliados.", enabled: false, category: "growth" },
  { key: "lit_protection", label: "Proteção LIT", description: "Cobertura para compradores.", enabled: true, category: "safety" },
  { key: "kyc_required", label: "KYC obrigatório", description: "Exigir verificação para vender.", enabled: false, category: "safety" },
  { key: "auto_delivery", label: "Entrega automática", description: "Entrega instantânea de códigos.", enabled: true, category: "marketplace" },
  { key: "public_questions", label: "Perguntas públicas", description: "Q&A na página do produto.", enabled: true, category: "marketplace" },
  { key: "chat", label: "Chat comprador/vendedor", description: "Sistema de mensagens.", enabled: true, category: "marketplace" },
  { key: "reports", label: "Denúncias", description: "Fluxo de denúncia ativo.", enabled: true, category: "safety" },
  { key: "maintenance", label: "Modo manutenção", description: "Bloqueia toda a plataforma.", enabled: false, category: "system" },
];

const contentPages: AdminContentPage[] = [
  { id: "cp-hero", slug: "home-hero", title: "Banner principal — Home", kind: "banner", status: "published", updatedAt: new Date(Date.now() - 3 * 86400e3).toISOString(), version: 12 },
  { id: "cp-featured", slug: "home-featured", title: "Seções em destaque — Home", kind: "banner", status: "published", updatedAt: new Date(Date.now() - 7 * 86400e3).toISOString(), version: 5 },
  { id: "cp-faq", slug: "faq", title: "Central de ajuda / FAQ", kind: "faq", status: "published", updatedAt: new Date(Date.now() - 30 * 86400e3).toISOString(), version: 21 },
  { id: "cp-terms", slug: "termos", title: "Termos de uso", kind: "policy", status: "published", updatedAt: new Date(Date.now() - 60 * 86400e3).toISOString(), version: 3 },
  { id: "cp-priv", slug: "privacidade", title: "Política de privacidade", kind: "policy", status: "published", updatedAt: new Date(Date.now() - 60 * 86400e3).toISOString(), version: 4 },
  { id: "cp-safety", slug: "seguranca", title: "Segurança e boas práticas", kind: "page", status: "published", updatedAt: new Date(Date.now() - 20 * 86400e3).toISOString(), version: 2 },
  { id: "cp-refund", slug: "reembolso", title: "Política de reembolso", kind: "policy", status: "published", updatedAt: new Date(Date.now() - 45 * 86400e3).toISOString(), version: 2 },
  { id: "cp-forbidden", slug: "itens-proibidos", title: "Itens proibidos", kind: "policy", status: "draft", updatedAt: new Date(Date.now() - 2 * 86400e3).toISOString(), version: 1 },
  { id: "cp-camp", slug: "campanha-litmax", title: "Campanha LIT-MAX 2026", kind: "campaign", status: "draft", updatedAt: new Date(Date.now() - 1 * 86400e3).toISOString(), version: 1 },
];

const reportMetrics: AdminReportMetric[] = [
  { id: "rev", label: "Receita 30d", value: "R$ 84.320,00", delta: "+12%", deltaDirection: "up" },
  { id: "gmv", label: "GMV 30d", value: "R$ 902.400,00", delta: "+8%", deltaDirection: "up" },
  { id: "orders", label: "Pedidos 30d", value: "3.284", delta: "+5%", deltaDirection: "up" },
  { id: "conv", label: "Conversão", value: "3,8%", delta: "-0,2 p.p.", deltaDirection: "down" },
  { id: "new_users", label: "Novos usuários", value: "1.412", delta: "+18%", deltaDirection: "up" },
  { id: "disputes", label: "Disputas abertas", value: "18", delta: "-3", deltaDirection: "up" },
];

const topCategoriesRows: AdminReportRow[] = [
  { id: "c1", label: "Contas Gaming", value: "R$ 380k", share: 42 },
  { id: "c2", label: "Gift Cards", value: "R$ 220k", share: 24 },
  { id: "c3", label: "Moedas Virtuais", value: "R$ 165k", share: 18 },
  { id: "c4", label: "Serviços Gaming", value: "R$ 90k", share: 10 },
  { id: "c5", label: "Software", value: "R$ 47k", share: 6 },
];

const topSellersRows: AdminReportRow[] = [
  { id: "s1", label: "NovaKeys", value: "R$ 84k" },
  { id: "s2", label: "Fenix Store", value: "R$ 62k" },
  { id: "s3", label: "PrimeAccounts", value: "R$ 48k" },
  { id: "s4", label: "SkyMarket", value: "R$ 41k" },
  { id: "s5", label: "GamerHub", value: "R$ 36k" },
];

const auditLog: AdminAuditLogEntry[] = [
  { id: "al-1", actor: "admin@litbuy", actorRole: "Admin", action: "Aprovou anúncio", entity: "Anúncio LIT-A1029", date: new Date(Date.now() - 15 * 60e3).toISOString(), ip: "192.0.2.10", severity: "info", result: "ok" },
  { id: "al-2", actor: "mod.kyc@litbuy", actorRole: "Moderador KYC", action: "Recusou verificação", entity: "KYC de Renata C.", date: new Date(Date.now() - 60 * 60e3).toISOString(), ip: "192.0.2.11", severity: "warning", result: "ok", summary: "Documento ilegível" },
  { id: "al-3", actor: "fin@litbuy", actorRole: "Financeiro", action: "Bloqueou saque", entity: "Saque WD-88123", date: new Date(Date.now() - 3 * 3600e3).toISOString(), ip: "192.0.2.12", severity: "critical", result: "ok" },
  { id: "al-4", actor: "support@litbuy", actorRole: "Suporte", action: "Respondeu disputa", entity: "Disputa D-4321", date: new Date(Date.now() - 5 * 3600e3).toISOString(), ip: "192.0.2.13", severity: "info", result: "ok" },
  { id: "al-5", actor: "system", actorRole: "Sistema", action: "Marcou anúncio como risco alto", entity: "Anúncio LIT-A1044", date: new Date(Date.now() - 8 * 3600e3).toISOString(), ip: "-", severity: "warning", result: "ok" },
  { id: "al-6", actor: "admin@litbuy", actorRole: "Admin", action: "Alterou taxa demonstrativa", entity: "Fee Nível Ouro (10% → 7.5%)", date: new Date(Date.now() - 24 * 3600e3).toISOString(), ip: "192.0.2.10", severity: "critical", result: "ok" },
  { id: "al-7", actor: "content@litbuy", actorRole: "Conteúdo", action: "Publicou página", entity: "Segurança e boas práticas", date: new Date(Date.now() - 48 * 3600e3).toISOString(), ip: "192.0.2.14", severity: "info", result: "ok" },
];

export const adminAdvancedService = {
  // Catálogo
  getCategories: () => delay(categories),
  getSubcategories: () => delay(subcategories),
  // Permissões
  getPermissions: () => delay(permissions),
  getRoles: () => delay(roles),
  // KYC
  getKycQueue: () => delay(kycQueue),
  // Financeiro
  getFees: () => delay(fees),
  getPaymentMethods: () => delay(paymentMethods),
  getLitPointsConfig: () => delay(litPoints),
  getSellerLevelConfigs: () => delay(sellerLevels),
  getPlans: () => delay(plans),
  // Flags e conteúdo
  getFeatureFlags: () => delay(flags),
  getContentPages: () => delay(contentPages),
  // Relatórios
  getReportMetrics: () => delay(reportMetrics),
  getTopCategoriesReport: () => delay(topCategoriesRows),
  getTopSellersReport: () => delay(topSellersRows),
  // Auditoria
  getAuditLog: () => delay(auditLog),
};
