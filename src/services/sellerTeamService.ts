import type {
  InviteMemberPayload,
  SellerTeamActivityEvent,
  SellerTeamInvite,
  SellerTeamMember,
  SellerTeamPermission,
  SellerTeamPermissionKey,
  SellerTeamRole,
} from "@/types";

/**
 * sellerTeamService — camada mockada de equipe/subcontas do vendedor.
 * Nenhuma permissão real é aplicada, nenhum convite real é enviado.
 * Em produção, deve ser substituído por RBAC completo com backend,
 * autenticação individual por membro e audit log.
 */

const delay = <T,>(data: T, ms = 200): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

const permissions: SellerTeamPermission[] = [
  { key: "view_dashboard", label: "Ver dashboard", description: "Acesso à visão geral do vendedor." },
  { key: "manage_listings", label: "Gerenciar anúncios", description: "Editar, pausar e remover anúncios." },
  { key: "create_listing", label: "Criar anúncio", description: "Publicar novos anúncios na loja." },
  { key: "reply_messages", label: "Responder mensagens", description: "Atender clientes via chat." },
  { key: "manage_deliveries", label: "Gerenciar entregas", description: "Marcar pedidos como entregues (mock)." },
  { key: "view_sales", label: "Ver vendas", description: "Acompanhar pedidos e status." },
  { key: "view_financials", label: "Ver financeiro", description: "Ver saldo e movimentações.", sensitive: true },
  { key: "request_withdraw", label: "Solicitar saque", description: "Retirar saldo disponível.", sensitive: true },
  { key: "manage_team", label: "Gerenciar equipe", description: "Convidar e remover membros.", sensitive: true },
  { key: "manage_store_settings", label: "Alterar configurações da loja", description: "Alterar dados públicos e políticas.", sensitive: true },
  { key: "handle_disputes", label: "Responder disputas", description: "Atender casos abertos pelo comprador." },
];

const ALL: SellerTeamPermissionKey[] = permissions.map((p) => p.key);

const roles: SellerTeamRole[] = [
  {
    id: "owner",
    name: "Dono da loja",
    description: "Acesso total: financeiro, equipe, configurações e anúncios.",
    tone: "primary",
    permissions: ALL,
  },
  {
    id: "manager",
    name: "Gerente",
    description: "Gerencia anúncios, mensagens e acompanha vendas. Não saca.",
    tone: "accent",
    permissions: [
      "view_dashboard",
      "manage_listings",
      "create_listing",
      "reply_messages",
      "manage_deliveries",
      "view_sales",
      "handle_disputes",
    ],
  },
  {
    id: "attendant",
    name: "Atendente",
    description: "Foco em atendimento ao comprador via mensagens.",
    tone: "success",
    permissions: ["view_dashboard", "reply_messages", "view_sales"],
  },
  {
    id: "delivery",
    name: "Operador de entrega",
    description: "Marca pedidos como entregues. Não vê saldo.",
    tone: "warning",
    permissions: ["view_dashboard", "view_sales", "manage_deliveries"],
  },
  {
    id: "finance",
    name: "Financeiro",
    description: "Acompanha saldo, movimentações e saques.",
    tone: "muted",
    permissions: ["view_dashboard", "view_sales", "view_financials", "request_withdraw"],
  },
];

const members: SellerTeamMember[] = [
  {
    id: "tm-1",
    name: "Você (Dono)",
    email: "dono@litbuy.demo",
    avatarUrl: "https://i.pravatar.cc/64?u=owner",
    roleId: "owner",
    status: "active",
    lastActive: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    joinedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 400).toISOString(),
  },
  {
    id: "tm-2",
    name: "Maria Souza",
    email: "maria@litbuy.demo",
    avatarUrl: "https://i.pravatar.cc/64?u=maria",
    roleId: "manager",
    status: "active",
    lastActive: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    joinedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString(),
  },
  {
    id: "tm-3",
    name: "João Lima",
    email: "joao@litbuy.demo",
    avatarUrl: "https://i.pravatar.cc/64?u=joao",
    roleId: "attendant",
    status: "active",
    lastActive: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    joinedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45).toISOString(),
  },
  {
    id: "tm-4",
    name: "Carlos Nunes",
    email: "carlos@litbuy.demo",
    avatarUrl: "https://i.pravatar.cc/64?u=carlos",
    roleId: "delivery",
    status: "active",
    lastActive: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    joinedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString(),
  },
  {
    id: "tm-5",
    name: "Ana Ribeiro",
    email: "ana@litbuy.demo",
    avatarUrl: "https://i.pravatar.cc/64?u=ana",
    roleId: "finance",
    status: "suspended",
    lastActive: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    joinedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 200).toISOString(),
  },
];

const invites: SellerTeamInvite[] = [
  {
    id: "in-1",
    name: "Rafael Torres",
    email: "rafael@litbuy.demo",
    roleId: "attendant",
    sentAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    message: "Bem-vindo à equipe, Rafa!",
  },
];

const activity: SellerTeamActivityEvent[] = [
  {
    id: "ta-1",
    memberName: "João Lima",
    action: "respondeu uma mensagem",
    target: "Pedido LIT-P394122",
    date: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    tone: "info",
    icon: "MessageSquare",
  },
  {
    id: "ta-2",
    memberName: "Maria Souza",
    action: "atualizou o anúncio",
    target: "Conta Valorant Imortal",
    date: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    tone: "success",
    icon: "Package",
  },
  {
    id: "ta-3",
    memberName: "Carlos Nunes",
    action: "marcou entrega",
    target: "Pedido LIT-P394101",
    date: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    tone: "success",
    icon: "Truck",
  },
  {
    id: "ta-4",
    memberName: "Ana Ribeiro",
    action: "visualizou o financeiro",
    date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    tone: "muted",
    icon: "Wallet",
  },
  {
    id: "ta-5",
    memberName: "Você",
    action: "enviou convite para",
    target: "Rafael Torres",
    date: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    tone: "info",
    icon: "UserPlus",
  },
];

export const sellerTeamService = {
  getTeamMembers: (): Promise<SellerTeamMember[]> => delay(members),
  getTeamRoles: (): Promise<SellerTeamRole[]> => delay(roles),
  getTeamPermissions: (): Promise<SellerTeamPermission[]> => delay(permissions),
  getPendingInvites: (): Promise<SellerTeamInvite[]> => delay(invites),
  getTeamActivity: (): Promise<SellerTeamActivityEvent[]> => delay(activity),

  simulateInviteMember: async (
    payload: InviteMemberPayload,
  ): Promise<{ ok: true; inviteId: string }> => {
    await delay(null, 300);
    void payload;
    return { ok: true, inviteId: `in-${Math.random().toString(36).slice(2, 8).toUpperCase()}` };
  },

  simulateUpdateMemberRole: async (
    memberId: string,
    roleId: SellerTeamRole["id"],
  ): Promise<{ ok: true }> => {
    await delay(null, 200);
    void memberId;
    void roleId;
    return { ok: true };
  },

  simulateRemoveMember: async (memberId: string): Promise<{ ok: true }> => {
    await delay(null, 200);
    void memberId;
    return { ok: true };
  },

  simulateCancelInvite: async (inviteId: string): Promise<{ ok: true }> => {
    await delay(null, 200);
    void inviteId;
    return { ok: true };
  },
};
