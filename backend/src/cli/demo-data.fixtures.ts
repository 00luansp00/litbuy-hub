import type { CatalogProductType, ListingDraftModel, ProductStatus } from '@prisma/client';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';

const uuid = (group: number, item: number) =>
  `d3${group.toString(16).padStart(2, '0')}0000-0000-4000-8000-${item.toString().padStart(12, '0')}`;
export const DEMO_DATE = new Date('2026-01-15T12:00:00.000Z');
export const demoProductDate = (index: number) =>
  new Date(DEMO_DATE.getTime() + index * 86_400_000);
export const DEMO_IDS = {
  users: { buyer: uuid(1, 1), seller: uuid(1, 2), admin: uuid(1, 3) },
  sellerApplication: uuid(2, 1),
  sellerProfile: uuid(2, 2),
  feePolicy: uuid(8, 1),
  feeRule: uuid(8, 2),
  feePolicyAuthor: uuid(8, 3),
  sellerReleasePolicy: uuid(8, 4),
  sellerReleaseRule: uuid(8, 5),
};
export const DEMO_FEE_POLICY = {
  id: DEMO_IDS.feePolicy,
  publicVersion: 2_026_011_500,
  effectiveFrom: DEMO_DATE,
  effectiveTo: null,
  author: {
    id: DEMO_IDS.feePolicyAuthor,
    email: 'financial-policy-baseline@demo.litbuy.local',
  },
  rule: {
    id: DEMO_IDS.feeRule,
    code: 'demo-zero-platform-commission',
    category: 'PLATFORM_COMMISSION',
    partyCharged: 'SELLER',
    formula: 'FIXED',
    fixedAmountMinor: 0n,
  },
} as const;
// LOCAL DEMO CONFIG ONLY. This is not a production seed or runtime fallback.
export const DEMO_SELLER_RELEASE_POLICY = {
  id: DEMO_IDS.sellerReleasePolicy,
  publicVersion: 2_026_011_501,
  effectiveFrom: DEMO_DATE,
  effectiveTo: null,
  author: DEMO_FEE_POLICY.author,
  rule: {
    id: DEMO_IDS.sellerReleaseRule,
    code: 'demo-default-seller-release',
    delayHours: 168,
    scope: 'DEFAULT',
  },
} as const;
export const DEMO_USERS = [
  { id: DEMO_IDS.users.buyer, email: 'comprador@demo.litbuy.local', roles: ['BUYER'] },
  { id: DEMO_IDS.users.seller, email: 'vendedor@demo.litbuy.local', roles: ['BUYER', 'SELLER'] },
  { id: DEMO_IDS.users.admin, email: 'admin@demo.litbuy.local', roles: ['BUYER', 'ADMIN'] },
] as const;
export const DEMO_CATEGORIES = [
  {
    id: uuid(3, 1),
    slug: 'demo-jogos',
    name: 'Jogos — Demonstração',
    children: ['contas', 'moedas', 'itens', 'servicos'],
  },
  {
    id: uuid(3, 2),
    slug: 'demo-gift-cards',
    name: 'Gift Cards — Demonstração',
    children: ['steam', 'playstation', 'xbox'],
  },
  {
    id: uuid(3, 3),
    slug: 'demo-software',
    name: 'Software — Demonstração',
    children: ['licencas'],
  },
].map((category, categoryIndex) => ({
  ...category,
  sortOrder: categoryIndex,
  subcategories: category.children.map((name, index) => ({
    id: uuid(4 + categoryIndex, index + 1),
    slug: `demo-${name}`,
    name: `${name[0].toUpperCase()}${name.slice(1)} — Demonstração`,
    sortOrder: index,
  })),
}));

const product = (
  index: number,
  slug: string,
  title: string,
  productType: CatalogProductType,
  model: ListingDraftModel,
  status: ProductStatus,
  category: number,
  subcategory: number,
  price: number | null,
  variants: Array<[string, number, number]>,
  service?: 'FIXED' | 'QUOTE',
) => ({
  id: uuid(10, index),
  draftId: uuid(11, index),
  imageId: uuid(12, index),
  slug: `demo-${slug}`,
  objectKey: `demo/products/${index}-${slug}.png`,
  createdAt: demoProductDate(index),
  title,
  description: `${title}. Conteúdo inteiramente fictício para validação local.`,
  productType,
  model,
  status,
  categoryId: DEMO_CATEGORIES[category].id,
  subcategoryId: DEMO_CATEGORIES[category].subcategories[subcategory].id,
  price,
  stock: model === 'NORMAL' ? 10 : null,
  service,
  variants: variants.map(([title, variantPrice, stock], variantIndex) => ({
    id: uuid(20 + index, variantIndex + 1),
    draftId: uuid(40 + index, variantIndex + 1),
    title,
    price: variantPrice,
    stock,
    sortOrder: variantIndex,
  })),
});
export const DEMO_PRODUCTS = [
  product(
    1,
    'conta-jogo',
    'Conta de jogo demonstrativa',
    'ACCOUNT',
    'NORMAL',
    'ACTIVE',
    0,
    0,
    49.9,
    [['Opção única', 49.9, 10]],
  ),
  product(
    2,
    'gift-card-steam-100',
    'Gift Card Steam R$ 100 — Demonstração',
    'GIFT_CARD',
    'NORMAL',
    'ACTIVE',
    1,
    0,
    100,
    [['R$ 100', 100, 20]],
  ),
  product(
    3,
    'moedas-virtuais',
    'Moedas virtuais — Pacotes demonstrativos',
    'VIRTUAL_CURRENCY',
    'DYNAMIC',
    'ACTIVE',
    0,
    1,
    null,
    [
      ['Pacote pequeno', 9.9, 30],
      ['Pacote médio', 19.9, 20],
      ['Pacote grande', 39.9, 10],
    ],
  ),
  product(
    4,
    'licenca-digital',
    'Licença digital — Opções demonstrativas',
    'SOFTWARE',
    'DYNAMIC',
    'ACTIVE',
    2,
    0,
    null,
    [
      ['Mensal', 29.9, 50],
      ['Anual', 199.9, 25],
    ],
  ),
  product(
    5,
    'servico-acompanhamento',
    'Serviço de acompanhamento — Demonstração',
    'SERVICE',
    'SERVICE',
    'ACTIVE',
    0,
    3,
    null,
    [['Sessão', 79.9, 1]],
    'FIXED',
  ),
  product(
    6,
    'servico-personalizado',
    'Serviço personalizado — Solicitar orçamento',
    'SERVICE',
    'SERVICE',
    'ACTIVE',
    0,
    3,
    null,
    [],
    'QUOTE',
  ),
  product(
    7,
    'produto-pausado',
    'Produto pausado — Demonstração',
    'ITEM',
    'NORMAL',
    'PAUSED',
    0,
    2,
    25,
    [['Opção única', 25, 5]],
  ),
  product(
    8,
    'produto-nao-publicado',
    'Produto não publicado — Demonstração',
    'KEY',
    'NORMAL',
    'UNPUBLISHED',
    2,
    0,
    35,
    [['Opção única', 35, 5]],
  ),
] as const;

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
const pngChunk = (type: string, data: Buffer) => {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
};
function coloredPng(index: number) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(4, 0);
  header.writeUInt32BE(4, 4);
  header[8] = 8;
  header[9] = 6;
  const pixels: number[] = [];
  for (let y = 0; y < 4; y += 1) {
    pixels.push(0);
    for (let x = 0; x < 4; x += 1)
      pixels.push(
        (index * 37 + x * 31) % 256,
        (index * 71 + y * 43) % 256,
        (index * 109 + x * y * 17) % 256,
        255,
      );
  }
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(Buffer.from(pixels))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}
export const DEMO_IMAGES = DEMO_PRODUCTS.map((product, index) => {
  const body = coloredPng(index + 1);
  return {
    id: product.imageId,
    productId: product.id,
    objectKey: product.objectKey,
    body,
    sha256: createHash('sha256').update(body).digest('hex'),
    contentType: 'image/png',
  };
});
export const DEMO_SUMMARY = {
  users: 3,
  sellers: 1,
  categories: 3,
  subcategories: 8,
  products: 8,
  publicProducts: 6,
  images: 8,
  feePolicies: 1,
} as const;
