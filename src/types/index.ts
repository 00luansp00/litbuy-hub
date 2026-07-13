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


/** Estado de disponibilidade do anúncio (mock). */
export type ProductStatus = "active" | "paused";

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
  /** Estoque disponível (mock). undefined = tratado como disponível. */
  stock?: number;
  /** Status do anúncio (mock). undefined = "active". */
  status?: ProductStatus;
  instantDelivery?: boolean;
  verifiedSeller?: boolean;
  /** 0-100 — indicador de confiança agregado do anúncio. */
  trustScore?: number;
  /** Marca explicitamente o anúncio como "Mais vendido". */
  bestSeller?: boolean;

  // ==============================
  // Sprint 18.8 — compatibilidade com o motor avançado de anúncios (18.7).
  // Todos os campos são opcionais para não quebrar produtos antigos.
  // ==============================
  listingModel?: ListingModel;
  productType?: ListingProductType;
  deliveryMode?: ListingDeliveryMode;
  promotionTier?: ListingPromotionTier;
  sellerPlan?: SellerPlanType;
  variants?: ListingVariant[];
  accountInfo?: ListingAccountInfo;
  attributes?: ListingAttributeValue[];
  subcategorySlug?: string;
  subcategoryName?: string;
  coverImage?: string;
  galleryImages?: string[];
  /** Configuração de moeda virtual (mock — cotação demonstrativa). */
  virtualCurrency?: VirtualCurrencyConfig;
  /** Preço "a partir de" — usado para produtos dinâmicos no card. */
  fromPrice?: number;
  /** Preço fixo do serviço; se ausente com model=service pode ser "sob orçamento". */
  servicePricingType?: ListingServicePricingType;
}

// ==================================================
// Sprint 18.8 — tipos do lado comprador (produto avançado).
// ==================================================

export interface VirtualCurrencyConfig {
  /** Nome/unidade (ex.: "Gold", "Robux", "Diamantes"). */
  unit: string;
  /** Preço mockado por unidade. */
  pricePerUnit: number;
  /** Quantidade mínima para compra. */
  minQuantity: number;
  /** Passo (incremento) sugerido para o input. */
  step?: number;
  /** Estoque disponível na unidade da moeda. */
  availableStock: number;
}

export interface VirtualCurrencyQuote {
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  belowMin: boolean;
  overStock: boolean;
}

export interface ProductVariantSelection {
  productId: string;
  variantId: string;
  variantTitle: string;
  unitPrice: number;
}

export type ProductPurchaseMode =
  | "normal"
  | "dynamic"
  | "service_fixed"
  | "service_quote"
  | "virtual_currency";

export interface ProductQuestionAnswer {
  id: string;
  authorName: string;
  authorRole: "seller" | "support";
  text: string;
  /** ISO date. */
  answeredAt: string;
}

export interface ProductQuestion {
  id: string;
  productId: string;
  authorName: string;
  text: string;
  /** ISO date. */
  askedAt: string;
  answer?: ProductQuestionAnswer;
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

export interface CartItemVariant {
  variantId: string;
  variantTitle: string;
  variantPrice: number;
}

export interface CartItem {
  /** Chave composta: productId ou `${productId}::${variantId}` / `::vc::qty`. */
  key: string;
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

  // Sprint 18.8 — compatível com produto dinâmico / moeda virtual.
  selectedVariantId?: string;
  selectedVariantTitle?: string;
  selectedVariantPrice?: number;
  /** Marca item como cotação de moeda virtual (unitLabel = unidade, quantity = qtd). */
  virtualCurrencyUnit?: string;
}

export interface MiniCartItem {
  key: string;
  productId: string;
  slug: string;
  title: string;
  image: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  variantTitle?: string;
  virtualCurrencyUnit?: string;
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

// ==================================================
// Checkout — tipos consumidos pelo checkoutService e
// pelos componentes em src/components/checkout.
// Fluxo 100% mockado; nenhum pagamento/pedido real.
// ==================================================

export type PaymentMethodId =
  | "pix"
  | "boleto"
  | "credit_card"
  | "lit_balance"
  | "lit_points"
  | "external_wallet";

export interface PaymentMethod {
  id: PaymentMethodId;
  label: string;
  description: string;
  /** Nome do ícone Lucide. */
  icon: string;
  /** Selo curto ex.: "Instantâneo", "Em breve". */
  tag?: string;
  /** Método visualmente desabilitado. */
  disabled?: boolean;
}

export interface BuyerProfile {
  name: string;
  email: string;
  verified: boolean;
  status: string;
  memberSince?: string;
  /** Documento fiscal fictício mascarado — nunca real. */
  maskedTaxId?: string;
}

export interface CheckoutSummary extends CartSummary {
  paymentMethodId?: PaymentMethodId;
  protectionFee?: number;
  operationalFee?: number;
  litPointsEarned?: number;
}

export type CheckoutStep = "review" | "payment" | "success";

export interface CheckoutPayload {
  buyer: BuyerProfile;
  paymentMethodId: PaymentMethodId;
  items: CartItem[];
  summary: CartSummary;
  protectionEnabled?: boolean;
}

export type MockOrderStatus = "created" | "pending_payment" | "confirmed";

export interface MockOrder {
  orderId: string;
  status: MockOrderStatus;
  createdAt: string;
  paymentMethodId: PaymentMethodId;
  paymentMethodLabel: string;
  total: number;
  itemCount: number;
  estimatedDelivery: string;
}

// ==================================================
// Sprint 18.9 — Checkout avançado, Proteção LIT,
// LIT Points e pagamento pendente (tudo mockado).
// ==================================================

export type PaymentStatus =
  | "pending"
  | "processing"
  | "approved"
  | "rejected"
  | "expired"
  | "cancelled";

export type CheckoutProtectionPlanId = "standard" | "lit_protection";

export interface CheckoutProtectionPlan {
  id: CheckoutProtectionPlanId;
  name: string;
  tagline: string;
  benefits: string[];
  /** Percentual sobre o subtotal (ex.: 0.15 = +15%). */
  extraFeePct: number;
  recommendedFor?: ListingProductType[];
}

export interface LitPointsCheckoutPreview {
  balance: number;
  earned: number;
  bonusFromProtection: number;
  /** BRL por 1 LIT Point (cotação demonstrativa). */
  quote: number;
  requiredForOrder: number;
}

export interface MockWalletBalance {
  balance: number;
  currency: "BRL";
}

export interface PaymentOperationalFee {
  method: PaymentMethodId;
  amount: number;
  label: string;
}

export interface PaymentSummary {
  subtotal: number;
  discount: number;
  protectionFee: number;
  operationalFee: number;
  total: number;
  litPointsEarned: number;
}

export interface PaymentPendingDetails {
  pixCode?: string;
  boletoLine?: string;
  boletoBarcode?: string;
  cardLast4?: string;
  installments?: number;
  litPointsUsed?: number;
  litBalanceUsed?: number;
}

export interface PaymentIntent {
  id: string;
  orderCode: string;
  method: PaymentMethodId;
  methodLabel: string;
  status: PaymentStatus;
  amount: number;
  createdAt: string;
  expiresAt?: string;
  items: CartItem[];
  summary: PaymentSummary;
  buyer: BuyerProfile;
  protectionEnabled: boolean;
  details: PaymentPendingDetails;
}

export type CheckoutAnalyticsEventName =
  | "view_item"
  | "add_to_cart"
  | "begin_checkout"
  | "select_payment_method"
  | "add_protection_plan"
  | "generate_payment"
  | "purchase_mocked"
  | "search"
  | "create_listing_mocked"
  | "order_conversation_created_mocked"
  | "seller_delivery_sent_mocked"
  | "buyer_confirmed_delivery_mocked"
  | "mediation_opened_mocked"
  | "seller_response_submitted_mocked"
  | "evidence_uploaded_mocked"
  | "notification_opened_mocked"
  | "notification_marked_read_mocked"
  | "notification_all_read_mocked"
  | "notification_clicked_mocked"
  | "report_dialog_opened_mocked"
  | "report_submitted_mocked"
  | "report_reason_selected_mocked"
  | "admin_report_review_opened_mocked"
  | "admin_report_action_mocked"
  | "affiliate_page_viewed_mocked"
  | "affiliate_link_copied_mocked"
  | "affiliate_material_copied_mocked"
  | "affiliate_payout_requested_mocked"
  | "affiliate_campaign_clicked_mocked"
  | "help_page_viewed_mocked"
  | "safety_page_viewed_mocked"
  | "contact_form_submitted_mocked"
  | "policy_page_viewed_mocked"
  | "prohibited_items_viewed_mocked"
  | "order_problem_clicked_mocked"
  | "mediation_dialog_opened_mocked"
  | "mediation_reason_selected_mocked"
  | "mediation_submitted_mocked"
  | "order_chat_system_notice_viewed_mocked"
  | "email_verification_viewed_mocked"
  | "email_resend_clicked_mocked"
  | "password_reset_requested_mocked"
  | "password_reset_completed_mocked"
  | "login_verification_submitted_mocked"
  | "communication_preferences_updated_mocked"
  | "email_template_previewed_mocked";

// ==================================================
// Denúncias / Reports (Sprint 18.15) — 100% mockado.
// ==================================================

export type ReportTargetType =
  | "product"
  | "seller"
  | "message"
  | "conversation"
  | "order"
  | "sale"
  | "user"
  | "payment"
  | "other";

export type ReportSeverity = "low" | "medium" | "high" | "critical";

export type ReportStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "action_required"
  | "resolved"
  | "rejected"
  | "closed";

export type ReportSource =
  | "product_page"
  | "seller_page"
  | "message_thread"
  | "order_page"
  | "sale_page"
  | "chat_order"
  | "admin"
  | "other";

export interface ReportReason {
  value: string;
  label: string;
  severity: ReportSeverity;
  description?: string;
}

export interface ReportEvidence {
  id: string;
  kind: "image" | "video" | "text" | "link" | "message";
  label: string;
  hint?: string;
}

export interface ReportContext {
  productId?: string;
  productTitle?: string;
  sellerId?: string;
  sellerSlug?: string;
  buyerId?: string;
  orderId?: string;
  orderCode?: string;
  saleId?: string;
  conversationId?: string;
  messageId?: string;
  paymentId?: string;
  category?: string;
  subcategory?: string;
  listingModel?: string;
  productType?: string;
  verificationStatus?: string;
  sellerLevel?: string;
  riskLevel?: ReportSeverity;
}

export interface ReportPayload {
  targetType: ReportTargetType;
  targetId: string;
  targetLabel: string;
  reason: string;
  reasonLabel: string;
  severity: ReportSeverity;
  description: string;
  evidence: ReportEvidence[];
  context?: ReportContext;
  source?: ReportSource;
}

export interface ReportResolution {
  action:
    | "acknowledged"
    | "warning_issued"
    | "listing_suspended"
    | "user_blocked"
    | "escalated_to_mediation"
    | "dismissed";
  note?: string;
  actor?: string;
  at: string;
}

export interface Report {
  id: string;
  code: string;
  targetType: ReportTargetType;
  targetId: string;
  targetLabel: string;
  reason: string;
  reasonLabel: string;
  severity: ReportSeverity;
  status: ReportStatus;
  description: string;
  reporterId: string;
  reporterName: string;
  reportedUserId?: string;
  reportedUserName?: string;
  context?: ReportContext;
  evidence: ReportEvidence[];
  source: ReportSource;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  resolution?: ReportResolution;
  internalNotes?: string[];
}



export interface CheckoutAnalyticsEvent {
  name: CheckoutAnalyticsEventName;
  payload?: Record<string, unknown>;
}


// ==================================================
// Área do Vendedor (Seller Dashboard) — tipos consumidos
// pelo sellerDashboardService e pelos componentes em
// src/components/seller-dashboard. Tudo 100% mockado.
// ==================================================

export type SellerListingStatus =
  | "active"
  | "paused"
  | "in_review"
  | "rejected"
  | "sold";

export interface SellerListing {
  id: string;
  slug: string;
  title: string;
  image: string;
  categoryName: string;
  categorySlug: string;
  price: number;
  stock: number;
  sales: number;
  views: number;
  rating: number;
  status: SellerListingStatus;
  createdAt: string; // ISO
  instantDelivery?: boolean;
}

export type SellerSaleStatus =
  | "pending"
  | "paid"
  | "delivered"
  | "completed"
  | "refunded"
  | "cancelled";

export interface SellerSalePreview {
  id: string;
  code: string;
  buyerName: string;
  buyerAvatar?: string;
  productTitle: string;
  productImage: string;
  amount: number;
  status: SellerSaleStatus;
  createdAt: string;
}

export type SellerFinancialMovementKind =
  | "sale"
  | "fee"
  | "refund"
  | "withdraw"
  | "adjustment";

export interface SellerFinancialMovement {
  id: string;
  kind: SellerFinancialMovementKind;
  description: string;
  amount: number; // positivo/negativo
  createdAt: string;
}

export interface SellerFinancialSummary {
  available: number;
  pending: number;
  totalSold: number;
  totalFees: number;
  currency: "BRL";
  movements: SellerFinancialMovement[];
}

export type SellerNotificationTone = "info" | "success" | "warning" | "danger";

export interface SellerNotification {
  id: string;
  title: string;
  description: string;
  tone: SellerNotificationTone;
  icon: string;
  createdAt: string;
  read?: boolean;
}

export interface SellerPerformanceMetric {
  id: string;
  label: string;
  value: string;
  icon: string;
  delta?: string;
  deltaDirection?: "up" | "down" | "neutral";
  tone?: AccountMetricTone;
  hint?: string;
}

export interface SellerDashboardSummary {
  seller: Seller;
  metrics: SellerPerformanceMetric[];
  pendingOrders: number;
  monthlyRevenue: number;
  responseRate: number; // 0-100
}

export interface CreateListingDraft {
  // Campos legados (mantidos para compatibilidade com o service).
  categorySlug?: string;
  platform?: string;
  listingKind?: string;
  title?: string;
  description?: string;
  price?: number;
  stock?: number;
  instantDelivery?: boolean;
  images?: string[];

  // Sprint 18.7 — anúncio avançado (visual/mockado).
  model?: ListingModel;
  productType?: ListingProductType;
  subcategorySlug?: string;
  attributes?: ListingAttributeValue[];

  dynamicItems?: ListingVariant[];
  service?: ListingServiceInfo;
  account?: ListingAccountInfo;

  coverImageId?: string;
  galleryImageIds?: string[];

  deliveryMode?: ListingDeliveryMode;
  secureVaultLines?: string[];

  promotionTier?: ListingPromotionTier;
  sellerPlan?: SellerPlanType;
  autoMessage?: string;

  notifications?: ListingNotificationPreferences;
}

/** Alias semântico para o payload do wizard avançado. */
export type ListingDraft = CreateListingDraft;

// ==================================================
// Sprint 18.7 — tipos do wizard avançado de anúncio.
// Tudo visual/mockado; sem backend, sem persistência.
// ==================================================

export type ListingModel = "normal" | "dynamic" | "service";

export type ListingProductType =
  | "account"
  | "virtual_currency"
  | "gift_card"
  | "key"
  | "skin"
  | "item"
  | "service"
  | "subscription"
  | "game"
  | "software"
  | "other";

export type ListingDeliveryMode = "manual" | "automatic";

export type ListingPromotionTier = "silver" | "gold" | "diamond";

export type SellerPlanType = "standard" | "lit_max";

export type ListingServicePricingType = "fixed" | "quote";

export interface ListingVariant {
  id: string;
  title: string;
  description?: string;
  price: number;
  stock: number;
  status: "active" | "paused";
}

export interface ListingServiceInfo {
  title?: string;
  description?: string;
  basePrice?: number;
  pricingType?: ListingServicePricingType;
  estimatedDelivery?: string;
  buyerRequirements?: string;
  notes?: string;
}

export type AccountProvenance =
  | "original_owner"
  | "reseller"
  | "third_party"
  | "other";

export type AccountRecoveryLevel =
  | "full"
  | "partial"
  | "none"
  | "unknown";

export interface ListingAccountInfo {
  provenance?: AccountProvenance;
  recoveryLevel?: AccountRecoveryLevel;
  emailVerified?: boolean;
  phoneLinked?: boolean;
  documentLinked?: boolean;
  fullAccess?: boolean;
  recoveryRisk?: "low" | "medium" | "high";
  warrantyNote?: string;
}

export interface Subcategory {
  slug: string;
  name: string;
  categorySlug: string;
}

export type ListingAttributeInputType =
  | "text"
  | "number"
  | "select";

export interface ListingAttributeConfig {
  key: string;
  label: string;
  type: ListingAttributeInputType;
  options?: string[];
  placeholder?: string;
}

export interface ListingAttributeValue {
  key: string;
  value: string;
}

export interface ListingImageConfig {
  coverImageId?: string;
  galleryImageIds: string[];
}

export interface ListingNotificationPreferences {
  inApp: boolean;
  browser: boolean;
  emailFuture: boolean;
  externalIntegrationFuture: boolean;
}

export interface PromotionTierInfo {
  tier: ListingPromotionTier;
  name: string;
  tagline: string;
  benefits: string[];
  demoFeePct: number;
  recommended?: boolean;
}

export interface SellerPlanInfo {
  plan: SellerPlanType;
  name: string;
  tagline: string;
  benefits: string[];
  premium?: boolean;
}



// ==================================================
// Painel Administrativo (Admin) — tipos consumidos pelo
// adminService e pelos componentes em src/components/admin.
// Tudo mockado; nenhuma ação real, nenhum RBAC real.
// Os contratos abaixo antecipam um futuro backend.
// ==================================================

export type AdminStatus =
  | "active"
  | "suspended"
  | "in_review"
  | "blocked"
  | "pending"
  | "approved"
  | "rejected"
  | "paused"
  | "removed"
  | "sold"
  | "paid"
  | "delivered"
  | "completed"
  | "cancelled"
  | "in_dispute"
  | "refunded"
  | "awaiting_payment"
  | "awaiting_buyer"
  | "awaiting_seller"
  | "open"
  | "resolved"
  | "closed";

export type AdminRiskLevel = "low" | "medium" | "high" | "critical";

export type AdminMetricTone =
  | "primary"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "muted";

export interface AdminMetric {
  id: string;
  label: string;
  value: string;
  icon: string; // lucide name
  delta?: string;
  deltaDirection?: "up" | "down" | "neutral";
  tone?: AdminMetricTone;
  hint?: string;
}

export type AdminAccountKind = "buyer" | "seller" | "buyer_seller" | "staff";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  status: AdminStatus;
  kind: AdminAccountKind;
  createdAt: string;
  orders: number;
  totalSpent: number;
  risk: AdminRiskLevel;
}

export interface AdminSeller {
  id: string;
  storeName: string;
  ownerName: string;
  avatarUrl?: string;
  slug?: string;
  status: AdminStatus;
  verified: boolean;
  activeListings: number;
  sales: number;
  rating: number;
  volume: number;
  risk: AdminRiskLevel;
}

export interface AdminListing {
  id: string;
  title: string;
  image: string;
  sellerName: string;
  categoryName: string;
  price: number;
  stock: number;
  status: AdminStatus;
  sales: number;
  reports: number;
  risk: AdminRiskLevel;
  slug?: string;
}

export interface AdminOrder {
  id: string;
  code: string;
  buyerName: string;
  sellerName: string;
  productTitle: string;
  amount: number;
  status: AdminStatus;
  paymentMethod: string;
  createdAt: string;
  risk: AdminRiskLevel;
}

export type AdminTransactionKind =
  | "payment"
  | "withdraw"
  | "refund"
  | "fee"
  | "balance_release";

export interface AdminTransaction {
  id: string;
  userName: string;
  kind: AdminTransactionKind;
  amount: number;
  status: AdminStatus;
  method: string;
  createdAt: string;
  reference: string;
  risk: AdminRiskLevel;
}

export interface AdminDispute {
  id: string;
  orderCode: string;
  buyerName: string;
  sellerName: string;
  reason: string;
  status: AdminStatus;
  priority: AdminRiskLevel;
  openedAt: string;
  updatedAt: string;
}

export type AdminReportTargetKind =
  | "listing"
  | "seller"
  | "user"
  | "message"
  | "order";

export interface AdminReport {
  id: string;
  targetKind: AdminReportTargetKind;
  targetLabel: string;
  reporterName: string;
  reason: string;
  status: AdminStatus;
  priority: AdminRiskLevel;
  createdAt: string;
}

export type AdminActivityTone = "info" | "success" | "warning" | "danger";

export interface AdminActivityEntry {
  id: string;
  title: string;
  description: string;
  tone: AdminActivityTone;
  icon: string;
  createdAt: string;
}

export interface AdminAlert {
  id: string;
  title: string;
  description: string;
  tone: AdminActivityTone;
  icon: string;
  action?: { label: string; to: string };
}

export interface AdminAuditLog {
  id: string;
  actor: string;
  action: string;
  target: string;
  createdAt: string;
  tone?: AdminActivityTone;
}

export interface AdminDashboardSummary {
  metrics: AdminMetric[];
  activity: AdminActivityEntry[];
  alerts: AdminAlert[];
  recentOrders: AdminOrder[];
  pendingListings: AdminListing[];
  openDisputes: AdminDispute[];
  topSellers: AdminSeller[];
}





// ==================================================
// Busca Global (Search) — tipos consumidos pelo
// searchService, pela rota /buscar e pelos componentes
// em src/components/search. Tudo mockado nesta sprint;
// substituível por API/backend futuramente.
// ==================================================

export type SearchSortOption =
  | "relevance"
  | "price_asc"
  | "price_desc"
  | "best_selling"
  | "best_rated"
  | "recent";

export interface SearchSortDescriptor {
  value: SearchSortOption;
  label: string;
}

export interface SearchFilters {
  categorySlug?: string;
  minPrice?: number;
  maxPrice?: number;
  instantDelivery?: boolean;
  verifiedSeller?: boolean;
  onlyAvailable?: boolean;
  minRating?: number;
  platform?: string;
}

export interface SearchFilterOption<V = string> {
  value: V;
  label: string;
  count?: number;
}

export interface SearchFacets {
  categories: SearchFilterOption[];
  priceRange: { min: number; max: number };
}

export interface SearchResult {
  query: string;
  products: Product[];
  total: number;
  sort: SearchSortOption;
  filters: SearchFilters;
}

export interface SearchSuggestion {
  id: string;
  label: string;
  kind: "product" | "category" | "seller" | "query";
  href?: string;
}

export interface PopularSearch {
  id: string;
  term: string;
  hits?: number;
}

export interface SearchStats {
  query: string;
  total: number;
  categoriesMatched: number;
  sellersMatched: number;
}


// ==================================================
// Pedido (Order) — pós-compra mockado.
// Consumido pelo orderService, pela rota /pedidos/$id e
// pelos componentes em src/components/orders/*.
// Todos os fluxos abaixo são visuais/mockados nesta sprint.
// ==================================================

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "awaiting_seller_delivery"
  | "delivered_by_seller"
  | "awaiting_buyer_confirmation"
  | "completed"
  | "cancelled"
  | "disputed"
  | "refunded";

export type DeliveryStatus =
  | "pending"
  | "in_progress"
  | "delivered"
  | "confirmed"
  | "failed";

export type DisputeStatus =
  | "none"
  | "open"
  | "under_review"
  | "resolved_buyer"
  | "resolved_seller"
  | "cancelled";

export interface OrderItem {
  id: string;
  productId: string;
  productSlug: string;
  productTitle: string;
  productImage: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface OrderTimelineEvent {
  id: string;
  kind:
    | "created"
    | "paid"
    | "seller_notified"
    | "delivery_started"
    | "delivered"
    | "buyer_confirmed"
    | "completed"
    | "dispute_opened"
    | "refunded"
    | "cancelled";
  label: string;
  description?: string;
  /** ISO date. */
  at: string;
  /** Evento ainda não ocorrido (visual futuro). */
  pending?: boolean;
}

export interface DigitalDelivery {
  status: DeliveryStatus;
  method: "auto" | "manual" | "chat";
  /** Instrução mockada para o comprador. */
  instructions?: string;
  /** Nunca preencher com dado real — apenas placeholder visual. */
  maskedPayload?: string;
  /** ISO date de entrega, se houver. */
  deliveredAt?: string;
}

export interface Dispute {
  id: string;
  orderId: string;
  status: DisputeStatus;
  reason?: string;
  description?: string;
  /** ISO date. */
  openedAt?: string;
  /** ISO date. */
  updatedAt?: string;
}

export interface OrderReview {
  id: string;
  orderId: string;
  productRating?: number;
  sellerRating?: number;
  comment?: string;
  /** ISO date. */
  submittedAt?: string;
}

export interface ReviewDraft {
  productRating: number;
  sellerRating: number;
  comment: string;
}

export interface OrderBuyer {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
}

export interface OrderSellerRef {
  id: string;
  name: string;
  slug?: string;
  avatarUrl?: string;
  verified?: boolean;
}

export interface Order {
  id: string;
  code: string;
  status: OrderStatus;
  /** ISO date. */
  createdAt: string;
  /** ISO date. */
  updatedAt: string;
  total: number;
  paymentMethod: string;
  buyer: OrderBuyer;
  seller: OrderSellerRef;
  items: OrderItem[];
  delivery: DigitalDelivery;
  dispute?: Dispute;
  review?: OrderReview;
  /** Sprint 18.9 — Proteção LIT (mock). */
  litProtection?: {
    active: boolean;
    /** ISO date de expiração da cobertura demonstrativa. */
    expiresAt: string;
  };
  /* Sprint 18.13 — vínculos mockados de pós-compra. */
  conversationId?: string;
  saleId?: string;
  paymentId?: string;
  deliveryMode?: SaleDeliveryMode;
  deliveryStatus?: SaleDeliveryStatus;
  sellerPlan?: "prata" | "ouro" | "diamante";
  hasAutomaticMessage?: boolean;
  protectionLitActive?: boolean;
  mediationStatus?: MediationStatus;

  evidenceCount?: number;
  sellerResponseStatus?: "none" | "pending" | "submitted";
  automaticMessage?: string;
}


// ============================================================
// Mensagens / conversas (mockado — Sprint 18.5)
// ============================================================

export type ConversationType = "pre_purchase" | "order_related" | "support";
export type MessageStatus = "sent" | "delivered" | "read" | "pending";
export type ParticipantRole = "buyer" | "seller" | "support" | "system";

export interface ConversationParticipant {
  id: string;
  name: string;
  avatarUrl?: string;
  role: ParticipantRole;
  sellerSlug?: string;
  verified?: boolean;
}

export interface MessageAttachment {
  id: string;
  kind: "image" | "file" | "link";
  label: string;
  url?: string;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  authorId: string;
  authorRole: ParticipantRole;
  text: string;
  /** ISO date. */
  sentAt: string;
  status: MessageStatus;
  attachments?: MessageAttachment[];
  system?: boolean;
}

export interface ConversationLastMessage {
  text: string;
  /** ISO date. */
  sentAt: string;
  authorRole: ParticipantRole;
}

export interface ConversationContext {
  type: ConversationType;
  productId?: string;
  productSlug?: string;
  productTitle?: string;
  productImage?: string;
  productPrice?: number;
  orderId?: string;
  orderCode?: string;
  orderStatus?: OrderStatus;
  sellerSlug?: string;
  sellerName?: string;
  note?: string;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  participants: ConversationParticipant[];
  /** Contraparte principal (não o usuário atual). */
  counterpart: ConversationParticipant;
  lastMessage: ConversationLastMessage;
  unreadCount: number;
  productId?: string;
  orderId?: string;
  sellerSlug?: string;
  context: ConversationContext;
}

/* ============================================================
 * Sprint 18.10 — LIT Points, Tarifas, Prazos e Níveis de Vendedor
 * ============================================================ */

export type LitPointsTransactionType =
  | "earned_purchase"
  | "earned_sale"
  | "earned_review"
  | "earned_bonus"
  | "redeemed_discount"
  | "expired"
  | "adjusted";

export interface LitPointsBalance {
  total: number;
  pending: number;
  earnedThisMonth: number;
  expiringSoon: number;
  nextExpirationDate?: string;
}

export interface LitPointsTransaction {
  id: string;
  type: LitPointsTransactionType;
  amount: number;
  description: string;
  createdAt: string;
}

export interface LitPointsRule {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export interface LitPointsUsageRule {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export interface LitPointsEarningPreview {
  purchaseAmount: number;
  basePoints: number;
  bonusPoints: number;
  totalPoints: number;
  tierMultiplier: number;
}

export interface LitPointsTierBenefit {
  level: SellerLevelName;
  multiplier: number;
  description: string;
}

export interface LitPointsFaqItem {
  q: string;
  a: string;
}

export type SellerLevelName =
  | "Bronze"
  | "Prata"
  | "Ouro"
  | "Diamante"
  | "Elite";

export interface SellerLevelRequirement {
  label: string;
  value: string;
}

export interface SellerLevelBenefit {
  icon: string;
  title: string;
  description: string;
}

export interface SellerLevelFeeRule {
  /** Taxa demonstrativa da plataforma em % sobre o valor da venda. */
  platformFeePercent: number;
}

export interface SellerLevelPayoutRule {
  /** Prazo demonstrativo, em horas, para liberação do saldo após conclusão. */
  releaseHours: number;
}

export interface SellerLevel {
  name: SellerLevelName;
  color: string;
  icon: string;
  tagline: string;
  requirements: SellerLevelRequirement[];
  benefits: SellerLevelBenefit[];
  fee: SellerLevelFeeRule;
  payout: SellerLevelPayoutRule;
}

export interface SellerLevelProgress {
  current: SellerLevelName;
  next?: SellerLevelName;
  completedSales: number;
  positiveReviews: number;
  disputeRate: number;
  responseTime: string;
  onTimeRate: number;
  progressToNext: number; // 0-100
}

export interface PromotionTierPricing {
  tier: "Prata" | "Ouro" | "Diamante";
  description: string;
  visibility: string;
  feeHint: string;
}

export interface LitMaxBenefit {
  icon: string;
  title: string;
  description: string;
}

export interface PaymentMethodFee {
  method: string;
  fee: string;
  note?: string;
}

export interface PayoutReleaseRule {
  situation: string;
  behavior: string;
}





// ============================================================================
// Sprint 18.11 — Verificação (KYC) e Equipe do Vendedor (visual/mockado)
// ============================================================================

export type VerificationStatus =
  | "not_started"
  | "in_progress"
  | "pending_review"
  | "approved"
  | "rejected"
  | "needs_more_info";

export type VerificationStepStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed";

export type VerificationDocumentType =
  | "rg"
  | "cnh"
  | "passport"
  | "foreign_id";

export interface VerificationStep {
  id: "basic" | "sms" | "document" | "selfie" | "review";
  title: string;
  description: string;
  status: VerificationStepStatus;
  icon: string;
}

export interface VerificationRequirement {
  id: string;
  label: string;
  helper?: string;
}

export interface VerificationAcceptedDocument {
  type: VerificationDocumentType;
  label: string;
  description: string;
}

export interface VerificationTimelineEvent {
  id: string;
  date: string;
  title: string;
  description?: string;
  tone: "info" | "success" | "warning" | "muted";
}

export interface VerificationSubmission {
  ok: true;
  submissionId: string;
  status: VerificationStatus;
}

export interface SellerVerificationBadge {
  sellerId: string;
  status: VerificationStatus;
  label: string;
  since?: string;
}

// --------------------------- Equipe do vendedor ---------------------------

export type SellerTeamMemberStatus = "active" | "pending" | "suspended";

export type SellerTeamPermissionKey =
  | "view_dashboard"
  | "manage_listings"
  | "create_listing"
  | "reply_messages"
  | "manage_deliveries"
  | "view_sales"
  | "view_financials"
  | "request_withdraw"
  | "manage_team"
  | "manage_store_settings"
  | "handle_disputes";

export interface SellerTeamPermission {
  key: SellerTeamPermissionKey;
  label: string;
  description: string;
  sensitive?: boolean;
}

export interface SellerTeamRole {
  id: "owner" | "manager" | "attendant" | "delivery" | "finance";
  name: string;
  description: string;
  tone: "primary" | "accent" | "success" | "warning" | "muted";
  permissions: SellerTeamPermissionKey[];
}

export interface SellerTeamMember {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  roleId: SellerTeamRole["id"];
  status: SellerTeamMemberStatus;
  lastActive?: string;
  joinedAt: string;
}

export interface SellerTeamInvite {
  id: string;
  name: string;
  email: string;
  roleId: SellerTeamRole["id"];
  message?: string;
  sentAt: string;
}

export interface SellerTeamActivityEvent {
  id: string;
  memberName: string;
  action: string;
  target?: string;
  date: string;
  tone: "info" | "success" | "warning" | "muted";
  icon: string;
}

export interface InviteMemberPayload {
  name: string;
  email: string;
  roleId: SellerTeamRole["id"];
  message?: string;
}

// ============================================================================
// Sprint 18.12 — Admin avançado (visual/mockado)
// ============================================================================


export interface AdminCategoryRow {
  id: string;
  slug: string;
  name: string;
  icon: string;
  color?: string;
  active: boolean;
  featured: boolean;
  order: number;
  listingsCount: number;
  reports: number;
  risk: AdminRiskLevel;
}

export interface AdminSubcategoryRow {
  id: string;
  slug: string;
  name: string;
  categoryId: string;
  active: boolean;
  listingsCount: number;
}

export interface AdminPermissionDef {
  key: string;
  label: string;
  group: "catalog" | "listings" | "users" | "kyc" | "financial" | "content" | "system";
  sensitive?: boolean;
}

export interface AdminRoleDef {
  id: string;
  name: string;
  description: string;
  active: boolean;
  permissions: string[];
  members: number;
}

export interface AdminKycReview {
  id: string;
  userName: string;
  userEmail: string;
  submittedAt: string;
  status: "pending_review" | "needs_more_info" | "approved" | "rejected";
  risk: AdminRiskLevel;
  documentType: "rg" | "cnh" | "passport";
  selfieProvided: boolean;
}

export interface AdminFeeConfig {
  id: string;
  label: string;
  percent: number;
  fixed?: number;
  active: boolean;
  note?: string;
}

export interface AdminPaymentMethodRow {
  id: "pix" | "boleto" | "card" | "lit_balance" | "lit_points" | "crypto";
  name: string;
  active: boolean;
  feePercent: number;
  minValue: number;
  maxValue: number;
  expirationHours?: number;
  environment: "demo" | "future";
}

export interface AdminLitPointsConfig {
  active: boolean;
  pointsPerPurchase: number;
  pointsPerSale: number;
  pointsPerReview: number;
  campaignBonus: number;
  expirationDays: number;
  maxUsePercentPerOrder: number;
  quote: number;
}

export interface AdminSellerLevelConfigRow {
  id: string;
  name: string;
  minSales: number;
  minRating: number;
  maxDisputeRate: number;
  platformFeePercent: number;
  releaseHours: number;
  priority: number;
  active: boolean;
}

export interface AdminPlanBenefitConfig {
  id: "lit_max" | "prata" | "ouro" | "diamante";
  name: string;
  active: boolean;
  priceMonthly?: number;
  feePercent?: number;
  benefits: string[];
  searchBoost?: number;
}

export interface AdminFeatureFlag {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  category: "marketplace" | "payment" | "growth" | "safety" | "system";
}

export interface AdminContentPage {
  id: string;
  slug: string;
  title: string;
  kind: "page" | "banner" | "faq" | "policy" | "campaign";
  status: "published" | "draft";
  updatedAt: string;
  version: number;
}

export interface AdminReportMetric {
  id: string;
  label: string;
  value: string;
  delta: string;
  deltaDirection: "up" | "down" | "neutral";
}

export interface AdminReportRow {
  id: string;
  label: string;
  value: string;
  share?: number;
}

export interface AdminAuditLogEntry {
  id: string;
  actor: string;
  actorRole: string;
  action: string;
  entity: string;
  date: string;
  ip: string;
  severity: "info" | "warning" | "critical";
  result: "ok" | "denied" | "failed";
  summary?: string;
}

/* ============================================================
 * Sprint 18.13 — Detalhe da Venda, Chat do Pedido, Entrega e Mediação
 * (todos os tipos abaixo suportam somente dados mockados/visuais)
 * ============================================================ */

export type SaleDeliveryMode = "manual" | "automatic";

export type SaleDeliveryStatus =
  | "awaiting_payment"
  | "payment_approved"
  | "awaiting_seller_delivery"
  | "delivered_by_seller"
  | "automatic_delivery_released"
  | "awaiting_buyer_confirmation"
  | "completed"
  | "disputed"
  | "cancelled"
  | "refunded";

export type MediationStatus =
  | "none"
  | "opened"
  | "awaiting_buyer_evidence"
  | "awaiting_seller_response"
  | "under_review"
  | "resolved_buyer"
  | "resolved_seller"
  | "refunded"
  | "closed";

export type MediationActor = "buyer" | "seller" | "mediator" | "system";

export interface MediationEvidence {
  id: string;
  actor: MediationActor;
  kind: "image" | "video" | "text" | "file";
  label: string;
  /** URL ou preview mockado; nunca dado real. */
  preview?: string;
  submittedAt: string;
}

export interface MediationTimelineEvent {
  id: string;
  at: string;
  actor: MediationActor;
  label: string;
  description?: string;
}

export interface SellerMediationResponse {
  id: string;
  submittedAt: string;
  text: string;
}

export interface AdminMediationDecision {
  id: string;
  decidedAt: string;
  outcome: MediationStatus;
  note?: string;
}

export interface MediationCase {
  id: string;
  orderId: string;
  saleId?: string;
  status: MediationStatus;
  reason: string;
  amountInDispute: number;
  respondByAt?: string;
  openedAt: string;
  updatedAt: string;
  timeline: MediationTimelineEvent[];
  evidence: MediationEvidence[];
  sellerResponse?: SellerMediationResponse;
  adminDecision?: AdminMediationDecision;
  /** Trechos do chat usados como evidência. */
  chatExcerpts?: Array<{ id: string; author: MediationActor; text: string; sentAt: string }>;
}

export interface OrderChatAttachment {
  id: string;
  kind: "image" | "file" | "link";
  label: string;
}

export interface OrderChatMessage {
  id: string;
  conversationId: string;
  orderId: string;
  authorId: string;
  authorRole: ParticipantRole;
  text: string;
  sentAt: string;
  system?: boolean;
  attachments?: OrderChatAttachment[];
}

export interface OrderConversationContext {
  conversationId: string;
  orderId: string;
  orderCode: string;
  buyerId: string;
  sellerId: string;
  productId: string;
  saleId?: string;
  paymentId?: string;
  orderStatus: OrderStatus;
  deliveryStatus: SaleDeliveryStatus;
  hasAutomaticMessage: boolean;
  automaticMessage?: string;
}

export interface OrderLinkedConversation {
  conversation: Conversation;
  context: OrderConversationContext;
  messages: ConversationMessage[];
}

export interface AutomaticDeliveryPreview {
  status: "released" | "pending" | "unavailable";
  maskedPayload: string;
  unitsRemaining: number;
  unitsTotal: number;
  releasedAt?: string;
}

export interface DeliveryInstruction {
  id: string;
  text: string;
  sentAt: string;
}

export interface SellerSaleFinancialSummary {
  gross: number;
  platformFee: number;
  planLabel?: string;
  litMaxFee?: number;
  litProtectionFee?: number;
  net: number;
  pending: number;
  blockedInDispute: number;
  expectedReleaseAt?: string;
  sellerLevelHint?: string;
}

export interface SellerSaleTimelineEvent {
  id: string;
  at: string;
  kind:
    | "order_created"
    | "payment_approved"
    | "chat_created"
    | "automatic_message_sent"
    | "seller_notified"
    | "delivery_sent"
    | "buyer_confirmed"
    | "dispute_opened"
    | "mediation_under_review"
    | "mediation_decision"
    | "completed";
  label: string;
  description?: string;
  pending?: boolean;
}

export interface SellerSale {
  id: string;
  code: string;
  orderId: string;
  orderCode: string;
  status: SellerSaleStatus;
  createdAt: string;
  amount: number;
  buyerName: string;
  buyerAvatar?: string;
  productTitle: string;
  productImage: string;
  productSlug: string;
  variationLabel?: string;
  paymentMethod: string;
  deliveryMode: SaleDeliveryMode;
  deliveryStatus: SaleDeliveryStatus;
  hasAutomaticMessage: boolean;
  protectionLitActive: boolean;
  mediationStatus: MediationStatus;
  sellerPlan?: "prata" | "ouro" | "diamante";
  litPointsEstimate?: number;
  buyerId?: string;
  productId?: string;
  conversationId?: string;
}

export interface SellerSaleDetail extends SellerSale {
  timeline: SellerSaleTimelineEvent[];
  financial: SellerSaleFinancialSummary;
  automaticDelivery?: AutomaticDeliveryPreview;
  deliveryInstructions: DeliveryInstruction[];
  mediation?: MediationCase;
}

/* ============================================================
 * Sprint 18.14 — Central de Notificações (visual/mockado)
 * ============================================================ */

export type NotificationRole = "buyer" | "seller" | "admin" | "all";

export type NotificationPriority = "low" | "medium" | "high" | "critical";

export type NotificationStatus = "unread" | "read" | "archived";

export type NotificationType =
  | "order"
  | "payment"
  | "delivery"
  | "message"
  | "mediation"
  | "sale"
  | "listing"
  | "wallet"
  | "kyc"
  | "report"
  | "security"
  | "admin"
  | "system"
  | "reward"
  | "affiliate";

export interface NotificationTarget {
  type:
    | "order"
    | "sale"
    | "conversation"
    | "listing"
    | "user"
    | "admin"
    | "route";
  id?: string;
}

export interface NotificationAction {
  label: string;
  href?: string;
  toast?: string;
}

export interface Notification {
  id: string;
  title: string;
  description: string;
  type: NotificationType;
  role: NotificationRole;
  priority: NotificationPriority;
  status: NotificationStatus;
  /** ISO date. */
  createdAt: string;
  href?: string;
  target?: NotificationTarget;
  /** Nome de ícone do lucide-react (opcional). */
  icon?: string;
  actionLabel?: string;
}

export interface NotificationFilter {
  id: string;
  label: string;
  types?: NotificationType[];
  roles?: NotificationRole[];
  onlyUnread?: boolean;
}

export interface NotificationStats {
  total: number;
  unread: number;
  byType: Partial<Record<NotificationType, number>>;
  byPriority: Partial<Record<NotificationPriority, number>>;
}

/* ============================================================
 * Sprint 18.16 — Programa de Afiliados (visual/mockado)
 * ============================================================ */

export type AffiliateStatus =
  | "inactive"
  | "active"
  | "pending_review"
  | "suspended";

export type AffiliateCommissionStatus =
  | "pending"
  | "available"
  | "paid"
  | "cancelled"
  | "reversed";

export type AffiliateConversionType =
  | "signup"
  | "first_purchase"
  | "first_sale"
  | "recurring_sale"
  | "special_campaign";

export type AffiliateCampaignStatus = "active" | "upcoming" | "ended";

export type AffiliateMaterialType =
  | "banner"
  | "text"
  | "invite_card"
  | "creator_link"
  | "guide";

export interface AffiliateProfile {
  id: string;
  displayName: string;
  code: string;
  status: AffiliateStatus;
  joinedAt: string;
  tier: "starter" | "growth" | "pro" | "elite";
  suspensionReason?: string;
}

export interface AffiliateLink {
  url: string;
  code: string;
  shortUrl: string;
  qrCodeLabel: string;
}

export interface AffiliateStats {
  clicks: number;
  signups: number;
  buyersConverted: number;
  sellersReferred: number;
  salesGenerated: number;
  conversionRate: number;
  commissionPending: number;
  commissionAvailable: number;
  commissionTotal: number;
}

export interface AffiliateConversion {
  id: string;
  createdAt: string;
  type: AffiliateConversionType;
  referredUserMasked: string;
  status: "confirmed" | "pending" | "cancelled" | "reversed";
  saleAmount?: number;
  commissionAmount: number;
  commissionStatus: AffiliateCommissionStatus;
}

export interface AffiliateCommission {
  id: string;
  createdAt: string;
  description: string;
  amount: number;
  status: AffiliateCommissionStatus;
  releaseForecast?: string;
}

export interface AffiliateCommissionSummary {
  pending: number;
  available: number;
  paid: number;
  cancelled: number;
  reversed: number;
  minimumPayout: number;
  nextForecast?: string;
}

export interface AffiliateCampaign {
  id: string;
  title: string;
  description: string;
  period: string;
  bonusLabel: string;
  status: AffiliateCampaignStatus;
  ctaLabel: string;
}

export interface AffiliateMaterial {
  id: string;
  title: string;
  description: string;
  type: AffiliateMaterialType;
  copyText?: string;
  previewLabel: string;
}

export interface AffiliateRule {
  id: string;
  title: string;
  description: string;
  tone: "info" | "warning" | "danger";
}

export interface AffiliateFaqItem {
  q: string;
  a: string;
}

export interface AffiliatePayoutPreview {
  eligibleAmount: number;
  minimumPayout: number;
  estimatedProcessingDays: number;
  requiresKyc: boolean;
  note: string;
}



// ==================================================
// Info / Institutional pages (Sprint 18.17) — mocked.
// ==================================================

export interface InfoPageLink {
  label: string;
  to: string;
  description?: string;
  icon?: string;
}

export interface HelpCategory {
  id: string;
  title: string;
  description: string;
  icon: string;
  to: string;
}

export interface FaqItem {
  id: string;
  category: string;
  question: string;
  answer: string;
}

export interface StepItem {
  order: number;
  title: string;
  description: string;
  icon?: string;
}

export interface SafetyRule {
  id: string;
  title: string;
  description: string;
  tone: "info" | "warning" | "danger" | "success";
}

export interface PlatformRule {
  id: string;
  title: string;
  description: string;
  audience: "all" | "buyer" | "seller" | "affiliate";
  severity: "info" | "warning" | "critical";
}

export interface ProhibitedItem {
  id: string;
  title: string;
  description: string;
  category: "prohibited" | "restricted" | "review";
  examples?: string[];
}

export interface RefundPolicyRule {
  id: string;
  title: string;
  description: string;
  eligible: boolean;
}

export interface ContactOption {
  id: string;
  title: string;
  description: string;
  channel: string;
  icon: string;
}

export interface ContactFormPayload {
  name: string;
  email: string;
  subject: string;
  category: string;
  message: string;
}

export interface LegalDraftNotice {
  title: string;
  description: string;
}

export interface PolicySection {
  id: string;
  title: string;
  body: string;
}



