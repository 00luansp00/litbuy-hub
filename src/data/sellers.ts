import type { Seller, SellerBadge } from "@/types";

const avatar = (seed: string) =>
  `https://i.pravatar.cc/160?u=${encodeURIComponent(seed)}`;

const cover = (seed: string) =>
  `https://picsum.photos/seed/${encodeURIComponent("cover-" + seed)}/1600/500`;

const BADGE_VERIFIED: SellerBadge = {
  kind: "verified",
  label: "Vendedor Verificado",
  description: "Identidade confirmada pela LIT Buy.",
};
const BADGE_TOP: SellerBadge = {
  kind: "top_seller",
  label: "Top Seller",
  description: "Entre os vendedores mais avaliados do marketplace.",
};
const BADGE_INSTANT: SellerBadge = {
  kind: "instant_delivery",
  label: "Entrega Instantânea",
  description: "Entrega automática após o pagamento.",
};
const BADGE_FAST_REPLY: SellerBadge = {
  kind: "fast_reply",
  label: "Resposta Rápida",
  description: "Responde em minutos, mesmo fora do horário comercial.",
};
const BADGE_PREMIUM: SellerBadge = {
  kind: "premium_member",
  label: "Membro Premium",
  description: "Assinante do plano avançado da LIT Buy.",
};
const BADGE_HIGH_REP: SellerBadge = {
  kind: "high_rep",
  label: "Alta Reputação",
  description: "Mais de 95% de avaliações positivas.",
};
const BADGE_SUPPORT: SellerBadge = {
  kind: "active_support",
  label: "Suporte Ativo",
  description: "Suporte disponível 7 dias por semana.",
};

/**
 * Base mockada de vendedores da LIT Buy.
 * Nunca importar diretamente em componentes/rotas — sempre via `sellerService`.
 */
export const sellers: Record<string, Seller> = {
  nova: {
    id: "s1",
    slug: "novakeys",
    name: "NovaKeys",
    avatarUrl: avatar("nova"),
    coverImage: cover("nova"),
    rating: 4.9,
    verified: true,
    level: "Diamante",
    responseTime: "< 5 min",
    salesCount: 12480,
    memberSince: "2021-03-14",
    description:
      "Especialistas em contas de FPS e MOBAs de alto nível. Curamos cada anúncio para garantir procedência e entrega instantânea. Atendimento 100% humano.",
    specialties: ["Valorant", "League of Legends", "CS2", "Contas Premium"],
    languages: ["Português", "Inglês", "Espanhol"],
    badges: [BADGE_VERIFIED, BADGE_TOP, BADGE_FAST_REPLY, BADGE_HIGH_REP, BADGE_SUPPORT],
    stats: {
      activeProducts: 84,
      totalSales: 12480,
      totalReviews: 3120,
      followers: 4820,
      responseTime: "< 5 min",
      satisfactionRate: 98,
    },
  },
  pixel: {
    id: "s2",
    slug: "pixelstore",
    name: "PixelStore",
    avatarUrl: avatar("pixel"),
    coverImage: cover("pixel"),
    rating: 4.8,
    verified: true,
    level: "Ouro",
    responseTime: "< 10 min",
    salesCount: 44320,
    memberSince: "2020-08-02",
    description:
      "A maior loja de gift cards digitais do marketplace: Steam, PSN, Xbox, Nintendo, Google Play e mais. Códigos gerados instantaneamente após a compra.",
    specialties: ["Gift Cards", "Assinaturas", "Steam", "PSN", "Xbox"],
    languages: ["Português", "Inglês"],
    badges: [BADGE_VERIFIED, BADGE_TOP, BADGE_INSTANT, BADGE_PREMIUM, BADGE_HIGH_REP],
    stats: {
      activeProducts: 210,
      totalSales: 44320,
      totalReviews: 15900,
      followers: 12800,
      responseTime: "< 10 min",
      satisfactionRate: 99,
    },
  },
  arena: {
    id: "s3",
    slug: "arena-gamer",
    name: "Arena Gamer",
    avatarUrl: avatar("arena"),
    coverImage: cover("arena"),
    rating: 4.7,
    verified: true,
    level: "Ouro",
    responseTime: "< 15 min",
    salesCount: 18740,
    memberSince: "2021-11-10",
    description:
      "Moedas para FIFA, Free Fire, Valorant e Roblox com entrega segura e discreta. Sem risco para a sua conta.",
    specialties: ["Moedas", "FIFA Ultimate Team", "Free Fire", "VP Valorant"],
    languages: ["Português", "Espanhol"],
    badges: [BADGE_VERIFIED, BADGE_INSTANT, BADGE_FAST_REPLY, BADGE_SUPPORT],
    stats: {
      activeProducts: 62,
      totalSales: 18740,
      totalReviews: 6420,
      followers: 3210,
      responseTime: "< 15 min",
      satisfactionRate: 96,
    },
  },
  drop: {
    id: "s4",
    slug: "dropzone",
    name: "DropZone",
    avatarUrl: avatar("drop"),
    coverImage: cover("drop"),
    rating: 4.6,
    verified: false,
    level: "Prata",
    responseTime: "< 30 min",
    salesCount: 2340,
    memberSince: "2023-05-22",
    description:
      "Loja especializada em skins raras de CS2 e itens de coleção. Todas as peças são inspecionadas antes da postagem.",
    specialties: ["Skins CS2", "Facas", "Itens Raros"],
    languages: ["Português"],
    badges: [BADGE_FAST_REPLY, BADGE_HIGH_REP],
    stats: {
      activeProducts: 48,
      totalSales: 2340,
      totalReviews: 640,
      followers: 890,
      responseTime: "< 30 min",
      satisfactionRate: 94,
    },
  },
  loot: {
    id: "s5",
    slug: "lootmaster",
    name: "LootMaster",
    avatarUrl: avatar("loot"),
    coverImage: cover("loot"),
    rating: 4.9,
    verified: true,
    level: "Diamante",
    responseTime: "< 8 min",
    salesCount: 9820,
    memberSince: "2022-01-18",
    description:
      "Especialistas em contas competitivas, itens de Roblox e Robux oficiais. Recuperamos ou reembolsamos qualquer pedido em até 24h.",
    specialties: ["Robux", "MM2", "Contas LoL", "Roblox"],
    languages: ["Português", "Inglês"],
    badges: [BADGE_VERIFIED, BADGE_TOP, BADGE_INSTANT, BADGE_FAST_REPLY, BADGE_HIGH_REP],
    stats: {
      activeProducts: 96,
      totalSales: 9820,
      totalReviews: 2410,
      followers: 3620,
      responseTime: "< 8 min",
      satisfactionRate: 98,
    },
  },
  neon: {
    id: "s6",
    slug: "neonmarket",
    name: "NeonMarket",
    avatarUrl: avatar("neon"),
    coverImage: cover("neon"),
    rating: 4.5,
    verified: false,
    level: "Prata",
    responseTime: "< 45 min",
    salesCount: 780,
    memberSince: "2024-02-05",
    description:
      "Vendedor emergente com foco em contas de mobile games. Preços agressivos e atendimento personalizado.",
    specialties: ["Contas Mobile", "Free Fire", "Wild Rift"],
    languages: ["Português"],
    badges: [BADGE_SUPPORT],
    stats: {
      activeProducts: 22,
      totalSales: 780,
      totalReviews: 210,
      followers: 320,
      responseTime: "< 45 min",
      satisfactionRate: 92,
    },
  },
  omega: {
    id: "s7",
    slug: "omega-games",
    name: "Omega Games",
    avatarUrl: avatar("omega"),
    coverImage: cover("omega"),
    rating: 5.0,
    verified: true,
    level: "Diamante",
    responseTime: "< 3 min",
    salesCount: 6420,
    memberSince: "2019-06-01",
    description:
      "Contas AAA, chaves originais e itens colecionáveis de alto valor. Vendedor há mais de 5 anos com histórico impecável.",
    specialties: ["Contas AAA", "Steam Keys", "Nintendo", "Colecionáveis"],
    languages: ["Português", "Inglês", "Espanhol", "Francês"],
    badges: [
      BADGE_VERIFIED,
      BADGE_TOP,
      BADGE_PREMIUM,
      BADGE_FAST_REPLY,
      BADGE_HIGH_REP,
      BADGE_SUPPORT,
    ],
    stats: {
      activeProducts: 154,
      totalSales: 6420,
      totalReviews: 1980,
      followers: 5410,
      responseTime: "< 3 min",
      satisfactionRate: 99,
    },
  },
  turbo: {
    id: "s8",
    slug: "turboboost",
    name: "TurboBoost",
    avatarUrl: avatar("turbo"),
    coverImage: cover("turbo"),
    rating: 4.8,
    verified: true,
    level: "Ouro",
    responseTime: "< 20 min",
    salesCount: 4210,
    memberSince: "2022-09-12",
    description:
      "Serviços profissionais de boost, coaching e desbloqueio de battle pass. Boosters ex-pro atendem em português.",
    specialties: ["Boost Ranked", "Coaching", "Battle Pass"],
    languages: ["Português", "Inglês"],
    badges: [BADGE_VERIFIED, BADGE_FAST_REPLY, BADGE_HIGH_REP, BADGE_SUPPORT],
    stats: {
      activeProducts: 34,
      totalSales: 4210,
      totalReviews: 1180,
      followers: 2140,
      responseTime: "< 20 min",
      satisfactionRate: 97,
    },
  },
};

export const sellersList: Seller[] = Object.values(sellers);
