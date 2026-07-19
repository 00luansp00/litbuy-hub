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

const PRODUCT_TYPES: ProductTypeOption[] = [
  { id: "account", name: "Conta" },
  { id: "virtual_currency", name: "Moeda virtual" },
  { id: "gift_card", name: "Gift card" },
  { id: "key", name: "Key / Código digital" },
  { id: "skin", name: "Skin" },
  { id: "item", name: "Item" },
  { id: "service", name: "Serviço" },
  { id: "subscription", name: "Assinatura" },
  { id: "game", name: "Jogo" },
  { id: "software", name: "Software" },
  { id: "other", name: "Outro" },
];

const SUBCATEGORIES: Subcategory[] = [
  { slug: "free-fire", name: "Free Fire", categorySlug: "contas" },
  { slug: "league-of-legends", name: "League of Legends", categorySlug: "contas" },
  { slug: "valorant", name: "Valorant", categorySlug: "contas" },
  { slug: "roblox", name: "Roblox", categorySlug: "contas" },
  { slug: "fortnite", name: "Fortnite", categorySlug: "contas" },
  { slug: "minecraft", name: "Minecraft", categorySlug: "contas" },
  { slug: "outros-contas", name: "Outros", categorySlug: "contas" },

  { slug: "steam", name: "Steam", categorySlug: "gift-cards" },
  { slug: "playstation", name: "PlayStation", categorySlug: "gift-cards" },
  { slug: "xbox", name: "Xbox", categorySlug: "gift-cards" },
  { slug: "google-play", name: "Google Play", categorySlug: "gift-cards" },

  { slug: "gold-wow", name: "Gold (WoW)", categorySlug: "moedas" },
  { slug: "riot-points", name: "Riot Points", categorySlug: "moedas" },
  { slug: "diamantes-ff", name: "Diamantes Free Fire", categorySlug: "moedas" },
  { slug: "robux", name: "Robux", categorySlug: "moedas" },
  { slug: "v-bucks", name: "V-Bucks", categorySlug: "moedas" },

  { slug: "skins-valorant", name: "Skins Valorant", categorySlug: "skins" },
  { slug: "skins-cs2", name: "Skins CS2", categorySlug: "skins" },
  { slug: "skins-lol", name: "Skins League of Legends", categorySlug: "skins" },

  { slug: "boost-elo", name: "Boost de Elo", categorySlug: "servicos" },
  { slug: "coaching", name: "Coaching", categorySlug: "servicos" },
  { slug: "farm", name: "Farm", categorySlug: "servicos" },
];

const ATTR_CONFIG: Record<string, ListingAttributeConfig[]> = {
  "league-of-legends": [
    {
      key: "elo",
      label: "Elo",
      type: "select",
      options: [
        "Ferro",
        "Bronze",
        "Prata",
        "Ouro",
        "Platina",
        "Esmeralda",
        "Diamante",
        "Mestre",
        "Grão-Mestre",
        "Desafiante",
      ],
    },
    {
      key: "servidor",
      label: "Servidor",
      type: "select",
      options: ["BR", "LAN", "NA", "EUW", "KR"],
    },
    { key: "skins", label: "Quantidade de skins", type: "number", placeholder: "0" },
    { key: "essencias", label: "Essências", type: "number", placeholder: "0" },
    { key: "campeoes", label: "Campeões", type: "number", placeholder: "0" },
    { key: "nivel", label: "Nível da conta", type: "number", placeholder: "0" },
  ],
  valorant: [
    {
      key: "elo",
      label: "Elo",
      type: "select",
      options: [
        "Ferro",
        "Bronze",
        "Prata",
        "Ouro",
        "Platina",
        "Diamante",
        "Ascendente",
        "Imortal",
        "Radiante",
      ],
    },
    { key: "servidor", label: "Servidor", type: "select", options: ["BR", "LATAM", "NA", "EU"] },
    { key: "agentes", label: "Agentes desbloqueados", type: "number", placeholder: "0" },
    { key: "skins_raras", label: "Skins raras", type: "number", placeholder: "0" },
    { key: "vp", label: "Pontos Valorant (VP)", type: "number", placeholder: "0" },
    { key: "nivel", label: "Nível da conta", type: "number", placeholder: "0" },
  ],
  "free-fire": [
    { key: "level", label: "Level", type: "number", placeholder: "0" },
    { key: "diamantes", label: "Diamantes", type: "number", placeholder: "0" },
    { key: "skins_raras", label: "Skins raras", type: "number", placeholder: "0" },
    { key: "personagens", label: "Personagens", type: "number", placeholder: "0" },
    { key: "regiao", label: "Região", type: "text", placeholder: "Ex.: Brasil" },
    {
      key: "vinculacao",
      label: "Vinculação da conta",
      type: "select",
      options: ["Facebook", "Google", "VK", "Convidado"],
    },
  ],
};

const VIRTUAL_CURRENCY_ATTRS: ListingAttributeConfig[] = [
  { key: "jogo", label: "Jogo", type: "text", placeholder: "Ex.: WoW" },
  { key: "servidor", label: "Servidor", type: "text", placeholder: "Ex.: Azralon" },
  { key: "quantidade", label: "Quantidade disponível", type: "number", placeholder: "0" },
  { key: "preco_unidade", label: "Preço por unidade (BRL)", type: "number", placeholder: "0,00" },
  { key: "compra_minima", label: "Quantidade mínima", type: "number", placeholder: "1" },
];

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
