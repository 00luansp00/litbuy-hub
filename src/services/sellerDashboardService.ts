import { products } from "@/data/products";
import { sellers } from "@/data/sellers";
import type {
  CreateListingDraft,
  Seller,
  SellerDashboardSummary,
  SellerFinancialMovement,
  SellerFinancialSummary,
  SellerListing,
  SellerNotification,
  SellerReview,
  SellerSalePreview,
} from "@/types";

/**
 * sellerDashboardService — camada mockada da Área do Vendedor.
 * Todos os dados são fictícios; nenhuma persistência, backend
 * ou publicação real é executada. Assinaturas assíncronas para
 * facilitar substituição futura por API/Supabase.
 */

const delay = <T,>(data: T, ms = 220): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

/** Vendedor mockado que representa o usuário logado nesta demo. */
const CURRENT_SELLER: Seller = sellers.nova;

const listingStatusPool: SellerListing["status"][] = [
  "active",
  "active",
  "paused",
  "in_review",
  "active",
  "sold",
  "rejected",
  "active",
];

const listings: SellerListing[] = products.slice(0, 8).map((p, i) => ({
  id: `sl-${i + 1}`,
  slug: p.slug,
  title: p.title,
  image: p.imageUrl,
  categoryName: p.categoryName,
  categorySlug: p.categorySlug,
  price: p.price,
  stock: 1 + ((i * 3) % 12),
  sales: 20 + ((i * 17) % 380),
  views: 400 + ((i * 137) % 3200),
  rating: p.rating,
  status: listingStatusPool[i]!,
  createdAt: new Date(Date.now() - (i + 1) * 86400000 * 3).toISOString(),
  instantDelivery: p.instantDelivery,
}));

const salesStatusPool: SellerSalePreview["status"][] = [
  "paid",
  "delivered",
  "completed",
  "pending",
  "refunded",
  "completed",
];

const BUYER_NAMES = [
  "Lucas M.",
  "Amanda R.",
  "Diego S.",
  "Renata C.",
  "Bruno F.",
  "Isabela T.",
];

const recentSales: SellerSalePreview[] = products.slice(0, 6).map((p, i) => ({
  id: `sale-${i + 1}`,
  code: `LIT-V${(304821 + i).toString()}`,
  buyerName: BUYER_NAMES[i % BUYER_NAMES.length]!,
  buyerAvatar: `https://i.pravatar.cc/64?u=buyer-${i}`,
  productTitle: p.title,
  productImage: p.imageUrl,
  amount: p.price,
  status: salesStatusPool[i % salesStatusPool.length]!,
  createdAt: new Date(Date.now() - i * 1000 * 60 * 60 * 26).toISOString(),
}));

const movements: SellerFinancialMovement[] = [
  {
    id: "fm-1",
    kind: "sale",
    description: "Venda — Conta Valorant Imortal",
    amount: 349.9,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
  },
  {
    id: "fm-2",
    kind: "fee",
    description: "Taxa da plataforma (10%)",
    amount: -34.99,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
  },
  {
    id: "fm-3",
    kind: "sale",
    description: "Venda — Gift Card Steam R$ 100",
    amount: 98.9,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(),
  },
  {
    id: "fm-4",
    kind: "withdraw",
    description: "Saque solicitado (Pix)",
    amount: -800,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 60).toISOString(),
  },
  {
    id: "fm-5",
    kind: "refund",
    description: "Estorno — Pedido cancelado",
    amount: -79.9,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(),
  },
  {
    id: "fm-6",
    kind: "adjustment",
    description: "Ajuste de bonificação LIT",
    amount: 25,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 240).toISOString(),
  },
];

const financial: SellerFinancialSummary = {
  available: 1284.5,
  pending: 432.9,
  totalSold: 18942.3,
  totalFees: 1894.23,
  currency: "BRL",
  movements,
};

const notifications: SellerNotification[] = [
  {
    id: "sn-1",
    title: "Novo pedido recebido",
    description: "Você tem 1 pedido aguardando confirmação de entrega.",
    tone: "success",
    icon: "PackageCheck",
    createdAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
  },
  {
    id: "sn-2",
    title: "Anúncio em análise",
    description: "O anúncio 'Conta LoL Diamante IV' está em revisão pela equipe.",
    tone: "info",
    icon: "SearchCheck",
    createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
  },
  {
    id: "sn-3",
    title: "Ative a verificação em 2 etapas",
    description: "Proteja sua conta de vendedor com autenticação em dois fatores.",
    tone: "warning",
    icon: "ShieldAlert",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
  },
];

const dashboardSummary: SellerDashboardSummary = {
  seller: CURRENT_SELLER,
  pendingOrders: 3,
  monthlyRevenue: 4823.5,
  responseRate: 98,
  metrics: [
    {
      id: "active",
      label: "Produtos ativos",
      value: String(listings.filter((l) => l.status === "active").length),
      icon: "Package",
      delta: "+2 no mês",
      deltaDirection: "up",
      tone: "primary",
    },
    {
      id: "monthly-sales",
      label: "Vendas no mês",
      value: "42",
      icon: "ShoppingBag",
      delta: "+18% vs mês anterior",
      deltaDirection: "up",
      tone: "success",
    },
    {
      id: "revenue",
      label: "Receita mockada",
      value: "R$ 4.823,50",
      icon: "DollarSign",
      delta: "+R$ 690 este mês",
      deltaDirection: "up",
      tone: "accent",
    },
    {
      id: "rating",
      label: "Avaliação média",
      value: CURRENT_SELLER.rating.toFixed(1),
      icon: "Star",
      delta: "98% positivas",
      deltaDirection: "up",
      tone: "warning",
    },
    {
      id: "response",
      label: "Taxa de resposta",
      value: "98%",
      icon: "MessageSquare",
      delta: "< 5 min de média",
      deltaDirection: "up",
      tone: "muted",
    },
    {
      id: "pending",
      label: "Pedidos pendentes",
      value: "3",
      icon: "Clock",
      delta: "Aguardando ação",
      deltaDirection: "neutral",
      tone: "warning",
    },
  ],
};

const REVIEW_COMMENTS = [
  "Entrega super rápida, produto exatamente como descrito.",
  "Atendimento excelente, tirou todas as minhas dúvidas.",
  "Já é minha terceira compra na loja, sempre confiável.",
  "Recomendo para todo mundo, vendedor sério.",
  "Chegou em minutos, muito prático.",
  "Preço justo e qualidade impecável.",
];

function generateSellerReviews(count: number): SellerReview[] {
  const sellerProducts = products.filter((p) => p.seller?.id === CURRENT_SELLER.id);
  return Array.from({ length: count }).map((_, i) => {
    const related = sellerProducts[i % Math.max(1, sellerProducts.length)];
    return {
      id: `sd-r${i}`,
      sellerId: CURRENT_SELLER.id,
      author: BUYER_NAMES[i % BUYER_NAMES.length]!,
      avatarUrl: `https://i.pravatar.cc/64?u=review-${i}`,
      rating: 4 + ((i % 3) === 0 ? 1 : 0.5),
      comment: REVIEW_COMMENTS[i % REVIEW_COMMENTS.length]!,
      date: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
      productTitle: related?.title,
    };
  });
}

export const sellerDashboardService = {
  getCurrentSeller: (): Promise<Seller> => delay(CURRENT_SELLER),

  getSellerDashboardSummary: (): Promise<SellerDashboardSummary> =>
    delay(dashboardSummary),

  getSellerListings: (): Promise<SellerListing[]> => delay(listings),

  getSellerRecentSales: (limit = 6): Promise<SellerSalePreview[]> =>
    delay(recentSales.slice(0, limit)),

  getSellerFinancialSummary: (): Promise<SellerFinancialSummary> => delay(financial),

  getSellerReviews: (limit = 8): Promise<SellerReview[]> =>
    delay(generateSellerReviews(limit)),

  getSellerNotifications: (): Promise<SellerNotification[]> => delay(notifications),

  createListingDraft: async (payload: CreateListingDraft): Promise<{ ok: true; draftId: string }> => {
    await delay(null, 400);
    // Nenhum dado é persistido — apenas gera um id fictício.
    const draftId = `draft-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    // Marca payload como usado para satisfazer o compilador.
    void payload;
    return { ok: true, draftId };
  },
};
