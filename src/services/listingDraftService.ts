import { catalogService } from "@/services/catalogService";
import type {
  Category,
  ListingAttributeConfig,
  ListingDraft,
  ListingModel,
  ListingProductType,
  PromotionTierInfo,
  SellerPlanInfo,
  Subcategory,
} from "@/types";

/**
 * listingDraftService — camada mockada do wizard avançado de criação de anúncio.
 *
 * IMPORTANTE:
 * - Nenhum dado é persistido.
 * - Taxonomia (categorias, subcategorias, tipos e atributos) vem do backend real.
 * - Nenhum arquivo real é enviado, nenhum cofre real é criado.
 * - Assinaturas assíncronas para facilitar substituição futura.
 */

const delay = <T>(data: T, ms = 200): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

interface ListingModelOption {
  id: ListingModel;
  name: string;
  description: string;
}

const LISTING_MODELS: ListingModelOption[] = [
  {
    id: "normal",
    name: "Normal",
    description: "Um único produto/modelo — ex.: uma conta específica, um gift card.",
  },
  {
    id: "dynamic",
    name: "Dinâmico",
    description: "Várias variações no mesmo anúncio — ex.: contas de níveis diferentes.",
  },
  {
    id: "service",
    name: "Serviço",
    description: "Boost, coaching, farm ou entrega sob demanda.",
  },
];

interface ProductTypeOption {
  id: ListingProductType;
  name: string;
}

const PROMOTION_TIERS: PromotionTierInfo[] = [
  {
    tier: "silver",
    name: "Prata",
    tagline: "Visibilidade padrão",
    benefits: [
      "Aparece nas buscas e categorias",
      "Taxa demonstrativa reduzida",
      "Ideal para começar",
    ],
    demoFeePct: 10,
  },
  {
    tier: "gold",
    name: "Ouro",
    tagline: "Mais destaque nas listagens",
    benefits: [
      "Prioridade visual moderada",
      "Melhor exposição nas categorias",
      "Selo Ouro no anúncio",
    ],
    demoFeePct: 12,
    recommended: true,
  },
  {
    tier: "diamond",
    name: "Diamante",
    tagline: "Exposição máxima",
    benefits: [
      "Prioridade visual superior",
      "Selo premium Diamante",
      "Destaque na Home e busca (futuro)",
    ],
    demoFeePct: 15,
  },
];

const SELLER_PLANS: SellerPlanInfo[] = [
  {
    plan: "standard",
    name: "Padrão",
    tagline: "Plano gratuito",
    benefits: ["Publicação de anúncios", "Suporte padrão", "Ferramentas essenciais"],
  },
  {
    plan: "lit_max",
    name: "LIT-MAX",
    tagline: "Plano premium da LIT Buy",
    benefits: [
      "Mensagem automática ao comprador",
      "Vantagens de exposição",
      "Possível redução de taxa",
      "Prioridade em suporte",
      "Recursos avançados de venda",
    ],
    premium: true,
  },
];

export const listingDraftService = {
  getListingModels: (): Promise<ListingModelOption[]> => delay(LISTING_MODELS),

  getProductTypes: (): Promise<ProductTypeOption[]> => catalogService.getProductTypes(),

  getCategories: (): Promise<Category[]> => catalogService.getCategories(),

  getSubcategoriesByCategory: (categorySlug: string): Promise<Subcategory[]> =>
    catalogService
      .getSubcategoriesByCategory(categorySlug)
      .then((items) => items.map((item) => ({ ...item, categorySlug }))),

  getAttributesForSubcategory: (
    subcategorySlug: string | undefined,
    productType: ListingProductType | undefined,
    categorySlug?: string,
  ): Promise<ListingAttributeConfig[]> =>
    catalogService.getAttributesForSubcategory(categorySlug, subcategorySlug, productType),

  getPromotionTiers: (): Promise<PromotionTierInfo[]> => delay(PROMOTION_TIERS),

  getSellerPlans: (): Promise<SellerPlanInfo[]> => delay(SELLER_PLANS),

  simulateSubmitListingDraft: async (
    payload: ListingDraft,
  ): Promise<{ ok: true; draftId: string }> => {
    await delay(null, 400);
    void payload;
    const draftId = `draft-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    return { ok: true, draftId };
  },
};

export type { ListingModelOption, ProductTypeOption };
