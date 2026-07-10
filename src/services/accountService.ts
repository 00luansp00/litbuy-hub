import { products } from "@/data/products";
import type {
  AccountNotification,
  AccountSummary,
  UserFavoritePreview,
  UserMessagePreview,
  UserOrderPreview,
  UserOrderStatus,
  WalletSummary,
} from "@/types";

/**
 * accountService — camada mockada da área do usuário.
 *
 * Todos os métodos são async para que a substituição por
 * chamadas REST/Supabase no futuro não exija mudanças na UI.
 */

const delay = <T,>(data: T, ms = 220): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

const summary: AccountSummary = {
  memberSince: "2023-05-14",
  verified: true,
  level: "LIT Prime",
  metrics: [
    {
      id: "orders",
      label: "Pedidos realizados",
      value: "12",
      icon: "ShoppingBag",
      delta: "+2 no mês",
      deltaDirection: "up",
      tone: "primary",
    },
    {
      id: "favorites",
      label: "Favoritos salvos",
      value: "8",
      icon: "Heart",
      delta: "+3 esta semana",
      deltaDirection: "up",
      tone: "accent",
    },
    {
      id: "unread",
      label: "Mensagens não lidas",
      value: "3",
      icon: "MessageSquare",
      delta: "2 vendedores",
      deltaDirection: "neutral",
      tone: "warning",
    },
    {
      id: "balance",
      label: "Saldo disponível",
      value: "R$ 248,30",
      icon: "Wallet",
      delta: "+R$ 120 este mês",
      deltaDirection: "up",
      tone: "success",
    },
    {
      id: "completed",
      label: "Compras concluídas",
      value: "10",
      icon: "CheckCircle2",
      delta: "83% de sucesso",
      deltaDirection: "up",
      tone: "success",
    },
    {
      id: "reviews",
      label: "Avaliações feitas",
      value: "7",
      icon: "Star",
      delta: "média 4.9",
      deltaDirection: "neutral",
      tone: "muted",
    },
  ],
};

const orderStatusPool: UserOrderStatus[] = [
  "completed",
  "processing",
  "delivered",
  "pending",
  "cancelled",
];

const recentOrders: UserOrderPreview[] = products.slice(0, 5).map((p, i) => ({
  id: `order-${i + 1}`,
  code: `LIT-${(102345 + i).toString()}`,
  productTitle: p.title,
  productImage: p.imageUrl,
  sellerName: p.seller?.name ?? "Vendedor LIT",
  status: orderStatusPool[i % orderStatusPool.length]!,
  total: p.price,
  createdAt: new Date(Date.now() - i * 1000 * 60 * 60 * 32).toISOString(),
}));

const recentFavorites: UserFavoritePreview[] = products
  .slice(0, 8)
  .map((p, i) => ({
    id: `fav-${i + 1}`,
    productId: p.id,
    addedAt: new Date(Date.now() - i * 1000 * 60 * 60 * 24).toISOString(),
  }));

const recentMessages: UserMessagePreview[] = products
  .slice(0, 5)
  .map((p, i) => ({
    id: `msg-${i + 1}`,
    sellerId: p.seller?.id ?? `seller-${i}`,
    sellerName: p.seller?.name ?? "Vendedor LIT",
    avatarUrl: p.seller?.avatarUrl,
    lastMessage:
      i === 0
        ? "Obrigado pela compra! O acesso já foi enviado no seu email."
        : i === 1
          ? "Boa tarde! Já estou preparando a entrega, tudo certo."
          : i === 2
            ? "Posso te ajudar com mais alguma coisa?"
            : i === 3
              ? "Novidade: acabei de publicar novos itens dessa categoria."
              : "Confirmado! Assim que o pagamento cair libero o produto.",
    lastMessageAt: new Date(Date.now() - i * 1000 * 60 * 42).toISOString(),
    unreadCount: i < 2 ? 2 - i : 0,
  }));

const wallet: WalletSummary = {
  balance: 248.3,
  pending: 89.9,
  currency: "BRL",
  transactions: [
    {
      id: "wt-1",
      kind: "credit",
      description: "Reembolso — Skin AK-47 Redline",
      amount: 79.9,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    },
    {
      id: "wt-2",
      kind: "debit",
      description: "Compra — Gift Card Steam R$ 100",
      amount: -98.9,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(),
    },
    {
      id: "wt-3",
      kind: "topup",
      description: "Depósito via PIX",
      amount: 200,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    },
    {
      id: "wt-4",
      kind: "debit",
      description: "Compra — Moedas FIFA 500K",
      amount: -79.9,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
    },
    {
      id: "wt-5",
      kind: "refund",
      description: "Estorno — Pedido cancelado",
      amount: 149.9,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(),
    },
  ],
};

const notifications: AccountNotification[] = [
  {
    id: "n-1",
    title: "Verifique seu email",
    description: "Confirme seu email para desbloquear a compra com um clique.",
    tone: "info",
    icon: "Mail",
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: "n-2",
    title: "Vendedor respondeu você",
    description: "Nova mensagem de Nova Games sobre seu pedido LIT-102345.",
    tone: "success",
    icon: "MessageSquare",
    createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
  },
  {
    id: "n-3",
    title: "Ative o 2FA",
    description: "Proteja sua conta ativando a autenticação em dois fatores.",
    tone: "warning",
    icon: "ShieldAlert",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
];

export const accountService = {
  getAccountSummary: (): Promise<AccountSummary> => delay(summary),
  getRecentOrders: (limit = 5): Promise<UserOrderPreview[]> =>
    delay(recentOrders.slice(0, limit)),
  getRecentFavorites: (limit = 8): Promise<UserFavoritePreview[]> =>
    delay(recentFavorites.slice(0, limit)),
  getRecentMessages: (limit = 5): Promise<UserMessagePreview[]> =>
    delay(recentMessages.slice(0, limit)),
  getWalletSummary: (): Promise<WalletSummary> => delay(wallet),
  getAccountNotifications: (): Promise<AccountNotification[]> =>
    delay(notifications),
};
