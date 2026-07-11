import { products } from "@/data/products";
import { sellers } from "@/data/sellers";
import type {
  AdminActivityEntry,
  AdminAlert,
  AdminAuditLog,
  AdminDashboardSummary,
  AdminDispute,
  AdminListing,
  AdminMetric,
  AdminOrder,
  AdminReport,
  AdminRiskLevel,
  AdminSeller,
  AdminStatus,
  AdminTransaction,
  AdminUser,
} from "@/types";

/**
 * adminService — camada mockada do Painel Administrativo.
 * TODOS os dados aqui são fictícios; nenhuma ação real, nenhum backend,
 * nenhum RBAC real. As páginas admin devem consumir apenas este service
 * — nunca importar mocks diretamente. Assinatura async para preparar
 * substituição futura por API/Supabase.
 */

const delay = <T,>(data: T, ms = 200): Promise<T> =>
  new Promise((r) => setTimeout(() => r(data), ms));

const riskPool: AdminRiskLevel[] = ["low", "low", "medium", "low", "high", "medium", "critical", "low"];
const userStatusPool: AdminStatus[] = ["active", "active", "in_review", "suspended", "active", "blocked"];
const sellerStatusPool: AdminStatus[] = ["approved", "active", "in_review", "suspended", "approved"];
const listingStatusPool: AdminStatus[] = ["active", "in_review", "paused", "active", "rejected", "removed", "active"];
const orderStatusPool: AdminStatus[] = [
  "awaiting_payment",
  "paid",
  "delivered",
  "completed",
  "cancelled",
  "in_dispute",
];
const txStatusPool: AdminStatus[] = ["pending", "approved", "rejected", "refunded", "in_review"];

const BUYER_NAMES = [
  "Ana Ribeiro",
  "Lucas Martins",
  "Amanda Rocha",
  "Diego Silva",
  "Renata Costa",
  "Bruno Ferraz",
  "Isabela Tavares",
  "Marcos Almeida",
];

const SELLER_LIST = Object.values(sellers);

const users: AdminUser[] = BUYER_NAMES.map((name, i) => ({
  id: `usr-${i + 1}`,
  name,
  email: `${name.toLowerCase().replace(/\s+/g, ".")}@mock.lit`,
  avatarUrl: `https://i.pravatar.cc/64?u=admin-user-${i}`,
  status: userStatusPool[i % userStatusPool.length]!,
  kind: i % 3 === 0 ? "buyer_seller" : "buyer",
  createdAt: new Date(Date.now() - (i + 1) * 86400000 * 9).toISOString(),
  orders: 2 + ((i * 7) % 40),
  totalSpent: 199 + ((i * 137) % 4200),
  risk: riskPool[i % riskPool.length]!,
}));

const sellersMock: AdminSeller[] = SELLER_LIST.map((s, i) => ({
  id: `asel-${i + 1}`,
  storeName: s.name,
  ownerName: s.name,
  avatarUrl: s.avatarUrl,
  slug: s.slug,
  status: sellerStatusPool[i % sellerStatusPool.length]!,
  verified: !!s.verified,
  activeListings: s.stats?.activeProducts ?? 12,
  sales: s.stats?.totalSales ?? s.salesCount ?? 120,
  rating: s.rating,
  volume: 4200 + ((i * 719) % 22000),
  risk: riskPool[i % riskPool.length]!,
}));

const listings: AdminListing[] = products.slice(0, 12).map((p, i) => ({
  id: `alis-${i + 1}`,
  title: p.title,
  image: p.imageUrl,
  sellerName: p.seller?.name ?? "Vendedor LIT",
  categoryName: p.categoryName,
  price: p.price,
  stock: p.stock ?? 5,
  status: listingStatusPool[i % listingStatusPool.length]!,
  sales: p.soldCount,
  reports: i % 4 === 0 ? 1 + (i % 3) : 0,
  risk: riskPool[i % riskPool.length]!,
  slug: p.slug,
}));

const PAY_METHODS = ["Pix", "Cartão de crédito", "Saldo LIT", "Carteira externa"];

const orders: AdminOrder[] = products.slice(0, 10).map((p, i) => ({
  id: `aord-${i + 1}`,
  code: `LIT-A${(701245 + i).toString()}`,
  buyerName: BUYER_NAMES[i % BUYER_NAMES.length]!,
  sellerName: p.seller?.name ?? "Vendedor LIT",
  productTitle: p.title,
  amount: p.price,
  status: orderStatusPool[i % orderStatusPool.length]!,
  paymentMethod: PAY_METHODS[i % PAY_METHODS.length]!,
  createdAt: new Date(Date.now() - i * 1000 * 60 * 60 * 8).toISOString(),
  risk: riskPool[i % riskPool.length]!,
}));

const TX_KIND_POOL: AdminTransaction["kind"][] = [
  "payment",
  "withdraw",
  "refund",
  "fee",
  "balance_release",
];

const transactions: AdminTransaction[] = Array.from({ length: 12 }).map((_, i) => ({
  id: `atx-${i + 1}`,
  userName: BUYER_NAMES[i % BUYER_NAMES.length]!,
  kind: TX_KIND_POOL[i % TX_KIND_POOL.length]!,
  amount: (i % 4 === 1 ? -1 : 1) * (50 + ((i * 173) % 950)),
  status: txStatusPool[i % txStatusPool.length]!,
  method: PAY_METHODS[i % PAY_METHODS.length]!,
  createdAt: new Date(Date.now() - i * 1000 * 60 * 60 * 5).toISOString(),
  reference: `REF-${(923000 + i * 37).toString(16).toUpperCase()}`,
  risk: riskPool[i % riskPool.length]!,
}));

const disputeStatusPool: AdminStatus[] = [
  "open",
  "awaiting_buyer",
  "awaiting_seller",
  "in_review",
  "resolved",
  "closed",
];

const DISPUTE_REASONS = [
  "Produto não entregue",
  "Conta bloqueada após entrega",
  "Descrição divergente do anunciado",
  "Cobrança duplicada",
  "Comprador sumiu após pagamento",
  "Suspeita de fraude",
];

const disputes: AdminDispute[] = Array.from({ length: 8 }).map((_, i) => ({
  id: `adp-${i + 1}`,
  orderCode: `LIT-A${(701245 + i).toString()}`,
  buyerName: BUYER_NAMES[i % BUYER_NAMES.length]!,
  sellerName: SELLER_LIST[i % SELLER_LIST.length]!.name,
  reason: DISPUTE_REASONS[i % DISPUTE_REASONS.length]!,
  status: disputeStatusPool[i % disputeStatusPool.length]!,
  priority: riskPool[i % riskPool.length]!,
  openedAt: new Date(Date.now() - (i + 1) * 1000 * 60 * 60 * 20).toISOString(),
  updatedAt: new Date(Date.now() - i * 1000 * 60 * 60 * 3).toISOString(),
}));

const REPORT_REASONS = [
  "Conteúdo suspeito",
  "Preço fora do padrão",
  "Comunicação agressiva",
  "Possível golpe",
  "Item proibido",
  "Perfil falso",
];

const REPORT_STATUS: AdminStatus[] = ["open", "in_review", "resolved", "closed"];

const reports: AdminReport[] = Array.from({ length: 9 }).map((_, i) => {
  const targets: AdminReport["targetKind"][] = ["listing", "seller", "user", "message", "order"];
  const kind = targets[i % targets.length]!;
  const label =
    kind === "listing"
      ? products[i % products.length]!.title
      : kind === "seller"
        ? SELLER_LIST[i % SELLER_LIST.length]!.name
        : kind === "user"
          ? BUYER_NAMES[i % BUYER_NAMES.length]!
          : kind === "message"
            ? `Conversa #${1000 + i}`
            : `Pedido LIT-A${(701245 + i).toString()}`;
  return {
    id: `arep-${i + 1}`,
    targetKind: kind,
    targetLabel: label,
    reporterName: BUYER_NAMES[(i + 3) % BUYER_NAMES.length]!,
    reason: REPORT_REASONS[i % REPORT_REASONS.length]!,
    status: REPORT_STATUS[i % REPORT_STATUS.length]!,
    priority: riskPool[i % riskPool.length]!,
    createdAt: new Date(Date.now() - i * 1000 * 60 * 60 * 6).toISOString(),
  };
});

const activity: AdminActivityEntry[] = [
  {
    id: "act-1",
    title: "Novo vendedor aguardando aprovação",
    description: `${SELLER_LIST[0]!.name} enviou documentação para verificação.`,
    tone: "info",
    icon: "UserCheck",
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
  {
    id: "act-2",
    title: "Anúncio removido por denúncia",
    description: `"${products[2]!.title}" foi removido após revisão da equipe.`,
    tone: "danger",
    icon: "ShieldAlert",
    createdAt: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
  },
  {
    id: "act-3",
    title: "Disputa resolvida a favor do comprador",
    description: "Pedido LIT-A701246 foi estornado após análise.",
    tone: "success",
    icon: "Gavel",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
  {
    id: "act-4",
    title: "Pico de acessos detectado",
    description: "Tráfego 32% acima do normal na última hora.",
    tone: "warning",
    icon: "Activity",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
  {
    id: "act-5",
    title: "Nova denúncia registrada",
    description: `Denúncia sobre "${products[4]!.title}" aguarda revisão.`,
    tone: "warning",
    icon: "Flag",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 9).toISOString(),
  },
];

const alerts: AdminAlert[] = [
  {
    id: "al-1",
    title: "3 disputas críticas abertas",
    description: "Priorize o atendimento das disputas com risco crítico nas últimas 24h.",
    tone: "danger",
    icon: "AlertTriangle",
    action: { label: "Ver disputas", to: "/admin/disputas" },
  },
  {
    id: "al-2",
    title: "5 vendedores aguardando aprovação",
    description: "Novos vendedores enviaram documentação e estão em fila.",
    tone: "info",
    icon: "UserPlus",
    action: { label: "Revisar vendedores", to: "/admin/vendedores" },
  },
  {
    id: "al-3",
    title: "Denúncias pendentes",
    description: "Existem denúncias sem revisão há mais de 12h.",
    tone: "warning",
    icon: "Flag",
    action: { label: "Ver denúncias", to: "/admin/denuncias" },
  },
];

const metrics: AdminMetric[] = [
  {
    id: "users",
    label: "Usuários cadastrados",
    value: "12.482",
    icon: "Users",
    delta: "+3,4% no mês",
    deltaDirection: "up",
    tone: "primary",
  },
  {
    id: "sellers",
    label: "Vendedores ativos",
    value: "1.204",
    icon: "Store",
    delta: "+42 novos",
    deltaDirection: "up",
    tone: "accent",
  },
  {
    id: "listings",
    label: "Anúncios ativos",
    value: "8.917",
    icon: "Package",
    delta: "+128 hoje",
    deltaDirection: "up",
    tone: "primary",
  },
  {
    id: "orders",
    label: "Pedidos hoje",
    value: "312",
    icon: "ShoppingBag",
    delta: "+12% vs ontem",
    deltaDirection: "up",
    tone: "success",
  },
  {
    id: "volume",
    label: "Volume transacionado",
    value: "R$ 184.923",
    icon: "DollarSign",
    delta: "+R$ 12,4k",
    deltaDirection: "up",
    tone: "success",
    hint: "Somatório mockado das últimas 24h",
  },
  {
    id: "disputes",
    label: "Disputas abertas",
    value: "17",
    icon: "Gavel",
    delta: "3 críticas",
    deltaDirection: "neutral",
    tone: "warning",
  },
  {
    id: "reports",
    label: "Denúncias pendentes",
    value: "9",
    icon: "Flag",
    delta: "aguardando revisão",
    deltaDirection: "neutral",
    tone: "warning",
  },
  {
    id: "approval",
    label: "Taxa de aprovação",
    value: "94%",
    icon: "CheckCircle2",
    delta: "estável",
    deltaDirection: "neutral",
    tone: "muted",
  },
];

const auditLogs: AdminAuditLog[] = [
  {
    id: "log-1",
    actor: "admin@lit.buy",
    action: "Suspendeu vendedor",
    target: SELLER_LIST[2]!.name,
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    tone: "warning",
  },
  {
    id: "log-2",
    actor: "admin@lit.buy",
    action: "Removeu anúncio por denúncia",
    target: products[5]!.title,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    tone: "danger",
  },
  {
    id: "log-3",
    actor: "moderacao@lit.buy",
    action: "Aprovou vendedor",
    target: SELLER_LIST[1]!.name,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    tone: "success",
  },
  {
    id: "log-4",
    actor: "admin@lit.buy",
    action: "Ajustou taxa da plataforma",
    target: "Padrão 10% → 9,5%",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    tone: "info",
  },
];

const dashboard: AdminDashboardSummary = {
  metrics,
  activity,
  alerts,
  recentOrders: orders.slice(0, 6),
  pendingListings: listings.filter((l) => l.status === "in_review").slice(0, 5),
  openDisputes: disputes.filter((d) => d.status !== "closed" && d.status !== "resolved").slice(0, 5),
  topSellers: [...sellersMock].sort((a, b) => b.volume - a.volume).slice(0, 5),
};

export const adminService = {
  getAdminDashboard: (): Promise<AdminDashboardSummary> => delay(dashboard),
  getAdminUsers: (): Promise<AdminUser[]> => delay(users),
  getAdminSellers: (): Promise<AdminSeller[]> => delay(sellersMock),
  getAdminListings: (): Promise<AdminListing[]> => delay(listings),
  getAdminOrders: (): Promise<AdminOrder[]> => delay(orders),
  getAdminTransactions: (): Promise<AdminTransaction[]> => delay(transactions),
  getAdminDisputes: (): Promise<AdminDispute[]> => delay(disputes),
  getAdminReports: (): Promise<AdminReport[]> => delay(reports),
  getAdminNotifications: (): Promise<AdminAlert[]> => delay(alerts),
  getAdminAuditLogs: (): Promise<AdminAuditLog[]> => delay(auditLogs),
};
