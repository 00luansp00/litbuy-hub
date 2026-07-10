export interface Category {
  id: string;
  slug: string;
  name: string;
  icon: string; // lucide icon name
  description?: string;
  /** Quantidade de anúncios ativos na categoria (mock). */
  listingCount?: number;
  /** Cor de destaque (token semântico ou variável CSS). */
  color?: string;
  /** @deprecated Use `listingCount`. Mantido apenas para compatibilidade. */
  productCount?: number;
}

/** Identificador de badge — chave para renderização iconográfica em SellerBadges. */
export type SellerBadgeKind =
  | "verified"
  | "top_seller"
  | "instant_delivery"
  | "fast_reply"
  | "premium_member"
  | "high_rep"
  | "active_support";

export interface SellerBadge {
  kind: SellerBadgeKind;
  label: string;
  description?: string;
}

export interface SellerStats {
  /** Produtos ativos publicados. */
  activeProducts: number;
  /** Vendas concluídas. */
  totalSales: number;
  /** Avaliações recebidas. */
  totalReviews: number;
  /** Seguidores (mock). */
  followers: number;
  /** Tempo médio de resposta (texto pronto ex.: "< 5 min"). */
  responseTime: string;
  /** Taxa de satisfação em porcentagem (0-100). */
  satisfactionRate: number;
}

export interface SellerSocialLink {
  label: string;
  /** Nome do ícone Lucide. */
  icon: string;
  url: string;
}

export interface SellerReview {
  id: string;
  sellerId: string;
  author: string;
  avatarUrl?: string;
  rating: number;
  comment: string;
  /** ISO date. */
  date: string;
  /** Produto avaliado (opcional). */
  productTitle?: string;
}

export interface Seller {
  id: string;
  /** Slug público do vendedor — usado em /loja/$slug. */
  slug?: string;
  name: string;
  avatarUrl?: string;
  /** Imagem de capa da loja pública. */
  coverImage?: string;
  rating: number;
  verified?: boolean;
  /** Nível (mock) exibido no perfil expandido. */
  level?: string;
  /** Tempo médio de resposta (mock, ex.: "< 5 min"). */
  responseTime?: string;
  /** Total de vendas do vendedor. */
  salesCount?: number;
  /** ISO date — quando o vendedor entrou. */
  memberSince?: string;
  /** Descrição / bio do vendedor. */
  description?: string;
  /** Especialidades (tags). */
  specialties?: string[];
  /** Idiomas atendidos. */
  languages?: string[];
  /** Badges de confiança concedidas pela plataforma. */
  badges?: SellerBadge[];
  /** Métricas agregadas para a página pública. */
  stats?: SellerStats;
  /** Links sociais/externos opcionais. */
  socials?: SellerSocialLink[];
}

export interface Review {
  id: string;
  productId: string;
  author: string;
  avatarUrl?: string;
  rating: number;
  comment: string;
  /** ISO date. */
  date: string;
}


export interface Product {
  id: string;
  slug: string;
  title: string;
  description?: string;
  categorySlug: string;
  categoryName: string;
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  rating: number;
  reviewsCount: number;
  soldCount: number;
  imageUrl: string;
  badge?: "hot" | "new" | "promo" | "top";
  seller?: Seller;
  stock?: number;
  instantDelivery?: boolean;
  verifiedSeller?: boolean;
  /** 0-100 — indicador de confiança agregado do anúncio. */
  trustScore?: number;
  /** Marca explicitamente o anúncio como "Mais vendido". */
  bestSeller?: boolean;
}

// ==================================================
// Área do Usuário (Account) — tipos consumidos pelo
// accountService e pelos componentes em src/components/account.
// Tudo mockado nesta sprint; o contrato foi desenhado para
// receber dados reais no futuro sem refatoração de UI.
// ==================================================

export type AccountMetricTone =
  | "primary"
  | "accent"
  | "success"
  | "warning"
  | "muted";

export interface AccountMetric {
  id: string;
  label: string;
  value: string;
  /** Nome do ícone Lucide (ex.: "ShoppingBag"). */
  icon: string;
  /** Variação em relação ao período anterior (mock). */
  delta?: string;
  deltaDirection?: "up" | "down" | "neutral";
  tone?: AccountMetricTone;
  hint?: string;
}

export interface AccountSummary {
  memberSince: string; // ISO date
  verified: boolean;
  level: string;
  metrics: AccountMetric[];
}

export type UserOrderStatus =
  | "pending"
  | "processing"
  | "delivered"
  | "completed"
  | "cancelled"
  | "refunded";

export interface UserOrderPreview {
  id: string;
  code: string;
  productTitle: string;
  productImage: string;
  sellerName: string;
  status: UserOrderStatus;
  total: number;
  /** ISO date. */
  createdAt: string;
}

export interface UserFavoritePreview {
  id: string;
  productId: string;
  addedAt: string; // ISO date
}

export interface UserMessagePreview {
  id: string;
  sellerId: string;
  sellerName: string;
  avatarUrl?: string;
  lastMessage: string;
  /** ISO date. */
  lastMessageAt: string;
  unreadCount: number;
}

export type WalletTransactionKind =
  | "credit"
  | "debit"
  | "refund"
  | "withdraw"
  | "topup";

export interface WalletTransaction {
  id: string;
  kind: WalletTransactionKind;
  description: string;
  amount: number; // positivo p/ crédito, negativo p/ débito
  createdAt: string; // ISO date
}

export interface WalletSummary {
  balance: number;
  pending: number;
  currency: "BRL";
  transactions: WalletTransaction[];
}

export type AccountNotificationTone = "info" | "success" | "warning" | "danger";

export interface AccountNotification {
  id: string;
  title: string;
  description: string;
  tone: AccountNotificationTone;
  /** Nome do ícone Lucide. */
  icon: string;
  /** ISO date. */
  createdAt: string;
  read?: boolean;
}

// ==================================================
// Carrinho (Cart) — tipos consumidos pelo CartProvider,
// cartService e componentes em src/components/cart.
// Estado 100% em memória; nenhum backend/persistência.
// ==================================================

export interface CartItem {
  productId: string;
  slug: string;
  title: string;
  image: string;
  category: string;
  categorySlug: string;
  sellerName: string;
  sellerSlug?: string;
  price: number;
  oldPrice?: number;
  quantity: number;
  instantDelivery?: boolean;
  verifiedSeller?: boolean;
}

export type CartCouponKind = "percent" | "fixed";

export interface CartCoupon {
  code: string;
  kind: CartCouponKind;
  /** Percentual (0-100) para "percent" ou valor em BRL para "fixed". */
  value: number;
  label: string;
}

export interface CartSummary {
  itemCount: number;
  subtotal: number;
  discount: number;
  platformFee: number;
  total: number;
}


