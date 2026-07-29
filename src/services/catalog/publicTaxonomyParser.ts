import type { Category, Subcategory } from "@/types";

export const CATALOG_ALLOWED_ICON_KEYS = [
  "UserCircle2",
  "Gift",
  "Coins",
  "Sparkles",
  "Package",
  "Wrench",
  "Rocket",
  "BadgeCheck",
  "MonitorSmartphone",
  "Gamepad2",
  "Play",
  "LayoutGrid",
] as const;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const slug = /^(?!.*--)[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;

export class CatalogResponseValidationError extends Error {
  constructor() {
    super("INVALID_CATALOG_RESPONSE");
    this.name = "CatalogResponseValidationError";
  }
}

function invalid(): never {
  throw new CatalogResponseValidationError();
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}
function string(value: unknown, pattern?: RegExp): string {
  if (typeof value !== "string" || !value.trim() || (pattern && !pattern.test(value))) invalid();
  return value;
}
function optionalString(value: unknown, pattern?: RegExp): string | undefined {
  if (value == null || value === "") return undefined;
  return string(value, pattern);
}
function listRoot(raw: unknown): unknown[] {
  const root = object(raw);
  if (!Array.isArray(root.items)) invalid();
  return root.items;
}

export function parsePublicCategoryResponse(raw: unknown): Category {
  const value = object(raw);
  const icon = optionalString(value.iconKey) ?? optionalString(value.icon);
  if (icon && !CATALOG_ALLOWED_ICON_KEYS.includes(icon as never)) invalid();
  const color =
    optionalString(value.colorHex, /^#[0-9A-Fa-f]{6}$/) ??
    optionalString(value.color, /^#[0-9A-Fa-f]{6}$/);
  return {
    id: string(value.id, uuid),
    slug: string(value.slug, slug),
    name: string(value.name),
    description: optionalString(value.description),
    icon: icon ?? "LayoutGrid",
    color,
    listingCount: undefined,
  };
}

export function parsePublicCategoryListResponse(raw: unknown): Category[] {
  return listRoot(raw).map(parsePublicCategoryResponse);
}

export function parsePublicSubcategoryResponse(raw: unknown): Subcategory & { id: string } {
  const value = object(raw);
  return {
    id: string(value.id, uuid),
    slug: string(value.slug, slug),
    name: string(value.name),
    categorySlug: optionalString(value.categorySlug, slug) ?? "",
  };
}

export function parsePublicSubcategoryListResponse(raw: unknown): Subcategory[] {
  return listRoot(raw).map(parsePublicSubcategoryResponse);
}
