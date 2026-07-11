import type {
  Notification,
  NotificationFilter,
  NotificationPriority,
  NotificationRole,
  NotificationStats,
  NotificationType,
} from "@/types";

/**
 * notificationService — Sprint 18.14
 *
 * Camada mockada de notificações. Nenhuma notificação real é
 * enviada, salva ou persistida. Nenhuma rota deve acessar mocks
 * diretamente — sempre consumir por este service (ou pelo
 * NotificationProvider).
 */

const delay = <T,>(data: T, ms = 180): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

function iso(hoursAgo: number): string {
  return new Date(Date.now() - hoursAgo * 3600_000).toISOString();
}

const NOTIFICATIONS: Notification[] = [
  // ================= Comprador =================
  {
    id: "n-buy-1",
    title: "Chat do pedido criado",
    description:
      "Conversa vinculada ao pedido LIT-102345 foi aberta com o vendedor.",
    type: "message",
    role: "buyer",
    priority: "medium",
    status: "unread",
    createdAt: iso(0.2),
    href: "/pedidos/order-1",
    target: { type: "order", id: "order-1" },
    icon: "MessageSquare",
    actionLabel: "Abrir pedido",
  },
  {
    id: "n-buy-2",
    title: "Pagamento aprovado",
    description: "Seu pagamento do pedido LIT-102345 foi aprovado (mock).",
    type: "payment",
    role: "buyer",
    priority: "high",
    status: "unread",
    createdAt: iso(0.4),
    href: "/pedidos/order-1",
    target: { type: "order", id: "order-1" },
    icon: "CreditCard",
    actionLabel: "Ver pedido",
  },
  {
    id: "n-buy-3",
    title: "Entrega automática liberada",
    description:
      "O item digital do pedido LIT-102345 foi liberado no cofre (demonstração).",
    type: "delivery",
    role: "buyer",
    priority: "high",
    status: "unread",
    createdAt: iso(0.5),
    href: "/pedidos/order-1",
    icon: "PackageCheck",
    actionLabel: "Ver entrega",
  },
  {
    id: "n-buy-4",
    title: "Nova mensagem do vendedor",
    description: "Você recebeu uma resposta sobre a entrega.",
    type: "message",
    role: "buyer",
    priority: "medium",
    status: "unread",
    createdAt: iso(2),
    href: "/mensagens/c1",
    icon: "MessageSquare",
  },
  {
    id: "n-buy-5",
    title: "Proteção LIT ativa",
    description:
      "Seu pedido está protegido por 90 dias (cobertura demonstrativa).",
    type: "security",
    role: "buyer",
    priority: "low",
    status: "read",
    createdAt: iso(6),
    href: "/pedidos/order-1",
    icon: "ShieldCheck",
  },
  {
    id: "n-buy-6",
    title: "Mediação aberta",
    description:
      "Uma mediação foi aberta no pedido LIT-102348. Envie provas se necessário.",
    type: "mediation",
    role: "buyer",
    priority: "critical",
    status: "unread",
    createdAt: iso(3),
    href: "/pedidos/order-4",
    icon: "Gavel",
    actionLabel: "Abrir mediação",
  },
  {
    id: "n-buy-7",
    title: "Pagamento pendente",
    description: "Seu Pix do pedido LIT-102346 ainda não foi confirmado.",
    type: "payment",
    role: "buyer",
    priority: "medium",
    status: "unread",
    createdAt: iso(1),
    href: "/pagamento/order-2",
    icon: "Clock",
    actionLabel: "Ver pagamento",
  },
  {
    id: "n-buy-8",
    title: "Avaliação disponível",
    description: "Como foi sua experiência com o pedido LIT-102348?",
    type: "order",
    role: "buyer",
    priority: "low",
    status: "read",
    createdAt: iso(24),
    href: "/pedidos/order-4",
    icon: "Star",
  },
  {
    id: "n-buy-9",
    title: "Você ganhou LIT Points",
    description: "+120 LIT Points creditados por uma compra concluída.",
    type: "reward",
    role: "buyer",
    priority: "low",
    status: "unread",
    createdAt: iso(30),
    href: "/lit-points",
    icon: "Sparkles",
  },

  // ================= Vendedor =================
  {
    id: "n-sel-1",
    title: "Nova venda recebida",
    description: "Você vendeu 'Conta Valorant Imortal' (mock).",
    type: "sale",
    role: "seller",
    priority: "high",
    status: "unread",
    createdAt: iso(0.3),
    href: "/vendedor/vendas/sale-1",
    target: { type: "sale", id: "sale-1" },
    icon: "ShoppingBag",
    actionLabel: "Ver venda",
  },
  {
    id: "n-sel-2",
    title: "Entrega pendente",
    description:
      "A venda LIT-V304821 está aguardando o envio manual da entrega.",
    type: "delivery",
    role: "seller",
    priority: "high",
    status: "unread",
    createdAt: iso(0.6),
    href: "/vendedor/vendas/sale-2",
    icon: "Truck",
  },
  {
    id: "n-sel-3",
    title: "Nova mensagem do comprador",
    description: "O comprador respondeu no chat do pedido LIT-102346.",
    type: "message",
    role: "seller",
    priority: "medium",
    status: "unread",
    createdAt: iso(1.2),
    href: "/mensagens/c1",
    icon: "MessageSquare",
  },
  {
    id: "n-sel-4",
    title: "Mediação aberta",
    description: "Uma disputa foi aberta na venda LIT-V304824.",
    type: "mediation",
    role: "seller",
    priority: "critical",
    status: "unread",
    createdAt: iso(2),
    href: "/vendedor/vendas/sale-4",
    icon: "Gavel",
  },
  {
    id: "n-sel-5",
    title: "Comprador confirmou recebimento",
    description:
      "Pedido LIT-102348 concluído — saldo será liberado (mock) após D+7.",
    type: "wallet",
    role: "seller",
    priority: "medium",
    status: "read",
    createdAt: iso(8),
    href: "/vendedor/financeiro",
    icon: "Wallet",
  },
  {
    id: "n-sel-6",
    title: "Saldo pendente gerado",
    description: "R$ 189,90 aguardando liberação (demonstração).",
    type: "wallet",
    role: "seller",
    priority: "low",
    status: "unread",
    createdAt: iso(10),
    href: "/vendedor/financeiro",
    icon: "Coins",
  },
  {
    id: "n-sel-7",
    title: "Nova avaliação recebida",
    description: "Você recebeu uma avaliação 5★ de um comprador.",
    type: "sale",
    role: "seller",
    priority: "low",
    status: "read",
    createdAt: iso(20),
    href: "/vendedor/avaliacoes",
    icon: "Star",
  },
  {
    id: "n-sel-8",
    title: "Anúncio aprovado",
    description: "Seu anúncio 'Cartão presente Steam R$ 100' está no ar.",
    type: "listing",
    role: "seller",
    priority: "medium",
    status: "unread",
    createdAt: iso(4),
    href: "/vendedor/anuncios",
    icon: "CheckCircle2",
  },
  {
    id: "n-sel-9",
    title: "LIT-MAX ativo",
    description: "Seu plano LIT-MAX está ativo — mensagens automáticas ligadas.",
    type: "system",
    role: "seller",
    priority: "low",
    status: "read",
    createdAt: iso(48),
    href: "/vendedor/anuncios/novo",
    icon: "Zap",
  },

  // ================= Admin =================
  {
    id: "n-adm-1",
    title: "KYC aguardando revisão",
    description: "3 verificações de identidade estão na fila.",
    type: "kyc",
    role: "admin",
    priority: "high",
    status: "unread",
    createdAt: iso(0.5),
    href: "/admin/verificacoes",
    icon: "BadgeCheck",
    actionLabel: "Revisar",
  },
  {
    id: "n-adm-2",
    title: "Nova denúncia pendente",
    description: "Comprador denunciou uma tentativa de contato externo.",
    type: "report",
    role: "admin",
    priority: "high",
    status: "unread",
    createdAt: iso(1),
    href: "/admin/denuncias",
    icon: "Flag",
  },
  {
    id: "n-adm-3",
    title: "Disputa precisa de mediação",
    description: "Pedido LIT-102348 aguarda decisão do mediador.",
    type: "mediation",
    role: "admin",
    priority: "critical",
    status: "unread",
    createdAt: iso(2),
    href: "/admin/disputas",
    icon: "Gavel",
  },
  {
    id: "n-adm-4",
    title: "Anúncio aguardando aprovação",
    description: "5 anúncios novos estão na fila de moderação.",
    type: "listing",
    role: "admin",
    priority: "medium",
    status: "unread",
    createdAt: iso(3),
    href: "/admin/anuncios",
    icon: "PackageSearch",
  },
  {
    id: "n-adm-5",
    title: "Usuário com risco alto",
    description: "Detecção mockada identificou padrão suspeito em 1 conta.",
    type: "security",
    role: "admin",
    priority: "critical",
    status: "unread",
    createdAt: iso(4),
    href: "/admin/usuarios",
    icon: "ShieldAlert",
  },
  {
    id: "n-adm-6",
    title: "Feature flag alterada",
    description:
      "Flag 'novo checkout' foi ativada em modo demonstração pelo admin.",
    type: "admin",
    role: "admin",
    priority: "low",
    status: "read",
    createdAt: iso(24),
    href: "/admin/configuracoes",
    icon: "ToggleRight",
  },
  {
    id: "n-adm-7",
    title: "Nova atividade no audit log",
    description: "12 novas entradas foram registradas no log de auditoria.",
    type: "admin",
    role: "admin",
    priority: "low",
    status: "unread",
    createdAt: iso(6),
    href: "/admin/auditoria",
    icon: "History",
  },

  // ================= Sistema (todos) =================
  {
    id: "n-sys-1",
    title: "Manutenção programada",
    description:
      "Uma janela de manutenção mockada está prevista para o próximo domingo.",
    type: "system",
    role: "all",
    priority: "low",
    status: "read",
    createdAt: iso(72),
    icon: "Info",
  },

  // ================= Afiliados =================
  {
    id: "n-aff-1",
    title: "Nova conversão de afiliado",
    description: "Um usuário indicado por você concluiu o cadastro (mock).",
    type: "affiliate",
    role: "all",
    priority: "medium",
    status: "unread",
    createdAt: iso(0.6),
    href: "/afiliados",
    icon: "Users",
    actionLabel: "Ver afiliados",
  },
  {
    id: "n-aff-2",
    title: "Comissão disponível",
    description: "Sua comissão de afiliado está disponível para saque demonstrativo.",
    type: "affiliate",
    role: "all",
    priority: "high",
    status: "unread",
    createdAt: iso(1.2),
    href: "/afiliados",
    icon: "Wallet",
  },
  {
    id: "n-aff-3",
    title: "Campanha iniciada",
    description: "A campanha 'Convide vendedores' está ativa (mock).",
    type: "affiliate",
    role: "all",
    priority: "low",
    status: "read",
    createdAt: iso(3),
    href: "/afiliados",
    icon: "Megaphone",
  },
];

// Estado mutável em memória (não persistido).
let store: Notification[] = NOTIFICATIONS.map((n) => ({ ...n }));

const FILTERS: NotificationFilter[] = [
  { id: "all", label: "Todas" },
  { id: "unread", label: "Não lidas", onlyUnread: true },
  { id: "orders", label: "Pedidos", types: ["order", "delivery"] },
  { id: "messages", label: "Mensagens", types: ["message"] },
  { id: "sales", label: "Vendas", types: ["sale"] },
  { id: "payments", label: "Pagamentos", types: ["payment", "wallet"] },
  { id: "mediation", label: "Mediação", types: ["mediation"] },
  { id: "security", label: "Segurança", types: ["security", "kyc", "report"] },
  { id: "admin", label: "Admin", types: ["admin", "listing"] },
  { id: "system", label: "Sistema", types: ["system", "reward"] },
];

function computeStats(list: Notification[]): NotificationStats {
  const byType: NotificationStats["byType"] = {};
  const byPriority: NotificationStats["byPriority"] = {};
  let unread = 0;
  for (const n of list) {
    byType[n.type as NotificationType] =
      (byType[n.type as NotificationType] ?? 0) + 1;
    byPriority[n.priority as NotificationPriority] =
      (byPriority[n.priority as NotificationPriority] ?? 0) + 1;
    if (n.status === "unread") unread++;
  }
  return { total: list.length, unread, byType, byPriority };
}

function filterForRoles(list: Notification[], roles: NotificationRole[]): Notification[] {
  const allow = new Set<NotificationRole>([...roles, "all"]);
  return list.filter((n) => allow.has(n.role));
}

export const notificationService = {
  getNotifications: (): Promise<Notification[]> => delay(store.slice()),

  getNotificationsByRole: (roles: NotificationRole[]): Promise<Notification[]> =>
    delay(filterForRoles(store, roles)),

  getRecentNotifications: (
    roles: NotificationRole[],
    limit = 5,
  ): Promise<Notification[]> =>
    delay(
      filterForRoles(store, roles)
        .filter((n) => n.status !== "archived")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit),
    ),

  getNotificationById: (id: string): Promise<Notification | null> =>
    delay(store.find((n) => n.id === id) ?? null),

  getUnreadCount: (roles?: NotificationRole[]): Promise<number> => {
    const list = roles ? filterForRoles(store, roles) : store;
    return delay(list.filter((n) => n.status === "unread").length);
  },

  getNotificationFilters: (): NotificationFilter[] => FILTERS,

  getNotificationStats: (roles?: NotificationRole[]): Promise<NotificationStats> => {
    const list = roles ? filterForRoles(store, roles) : store;
    return delay(computeStats(list));
  },

  /** Ações mockadas — alteram estado em memória (não persistido). */
  simulateMarkAsRead: (id: string): Promise<Notification | null> => {
    store = store.map((n) => (n.id === id ? { ...n, status: "read" } : n));
    return delay(store.find((n) => n.id === id) ?? null);
  },

  simulateMarkAllAsRead: (roles?: NotificationRole[]): Promise<{ ok: true }> => {
    const allow = roles ? new Set<NotificationRole>([...roles, "all"]) : null;
    store = store.map((n) =>
      (!allow || allow.has(n.role)) && n.status === "unread"
        ? { ...n, status: "read" }
        : n,
    );
    return delay({ ok: true });
  },

  simulateArchiveNotification: (id: string): Promise<{ ok: true }> => {
    store = store.map((n) => (n.id === id ? { ...n, status: "archived" } : n));
    return delay({ ok: true });
  },

  /** Restaura o estado inicial (útil apenas para testes visuais). */
  __resetForTests: () => {
    store = NOTIFICATIONS.map((n) => ({ ...n }));
  },
};
