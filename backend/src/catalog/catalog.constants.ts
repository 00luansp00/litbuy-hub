import type { CatalogAttributeInputType, CatalogProductType } from '@prisma/client';

export const CATALOG_ALLOWED_ICON_KEYS = [
  'UserCircle2',
  'Gift',
  'Coins',
  'Sparkles',
  'Package',
  'Wrench',
  'Rocket',
  'BadgeCheck',
  'MonitorSmartphone',
  'Gamepad2',
  'Play',
  'LayoutGrid',
] as const;
export const CATALOG_RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'auth',
  'login',
  'cadastro',
  'buscar',
  'produto',
  'categoria',
  'vendedor',
  'catalogo',
  'litbuy',
  'lit-buy',
]);
export const PRODUCT_TYPE_API: Record<CatalogProductType, { id: string; name: string }> = {
  ACCOUNT: { id: 'account', name: 'Conta' },
  VIRTUAL_CURRENCY: { id: 'virtual_currency', name: 'Moeda virtual' },
  GIFT_CARD: { id: 'gift_card', name: 'Gift card' },
  KEY: { id: 'key', name: 'Key / Código digital' },
  SKIN: { id: 'skin', name: 'Skin' },
  ITEM: { id: 'item', name: 'Item' },
  SERVICE: { id: 'service', name: 'Serviço' },
  SUBSCRIPTION: { id: 'subscription', name: 'Assinatura' },
  GAME: { id: 'game', name: 'Jogo' },
  SOFTWARE: { id: 'software', name: 'Software' },
  OTHER: { id: 'other', name: 'Outro' },
};
export const API_PRODUCT_TYPE = Object.fromEntries(
  Object.entries(PRODUCT_TYPE_API).map(([k, v]) => [v.id, k]),
) as Record<string, CatalogProductType>;
export const INPUT_TYPE_API: Record<
  CatalogAttributeInputType,
  'text' | 'number' | 'select' | 'boolean'
> = { TEXT: 'text', NUMBER: 'number', SELECT: 'select', BOOLEAN: 'boolean' };
