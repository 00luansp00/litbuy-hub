import { apiFetch } from "@/lib/api/client";

export const PRODUCT_STATUSES = ["UNPUBLISHED", "ACTIVE", "PAUSED", "REMOVED"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
export type ProductLifecycleAction = "ACTIVATE" | "PAUSE" | "RESUME" | "REMOVE";
export type ProductLifecycleState = {
  id: string;
  slug: string;
  status: ProductStatus;
  version: number;
  updatedAt: string;
  changed?: boolean;
};
export class ProductLifecyclePayloadError extends Error {
  readonly code = "PRODUCT_LIFECYCLE_RESPONSE_INVALID";
}
export const lifecycleErrorMessages: Record<string, string> = {
  PRODUCT_READY_COVER_REQUIRED: "Adicione uma imagem pronta e defina uma única capa.",
  PRODUCT_TAXONOMY_INACTIVE: "A categoria ou subcategoria não está ativa.",
  PRODUCT_TAXONOMY_MISMATCH: "A taxonomia do produto diverge do anúncio aprovado.",
  PRODUCT_SOURCE_NOT_APPROVED: "O anúncio de origem não permanece aprovado.",
  PRODUCT_VARIANT_INVALID: "Revise a variante, o preço e o estoque do produto.",
  PRODUCT_SERVICE_DETAILS_INVALID: "Revise os detalhes e o preço do serviço.",
  PRODUCT_VERSION_CONFLICT: "O produto foi alterado em outra sessão. Recarregamos o estado atual.",
  PRODUCT_REMOVED_TERMINAL: "A remoção deste produto é terminal nesta etapa.",
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const invalid = (): never => {
  throw new ProductLifecyclePayloadError("Resposta de ciclo de vida inválida.");
};
const iso = (value: unknown): value is string =>
  typeof value === "string" &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString() === value;

export function parseProductLifecycleState(
  value: unknown,
  requireChanged = false,
): ProductLifecycleState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  const x = value as Record<string, unknown>;
  if (
    !uuid.test(String(x.id)) ||
    typeof x.slug !== "string" ||
    !slug.test(x.slug) ||
    !PRODUCT_STATUSES.includes(x.status as ProductStatus) ||
    !Number.isInteger(x.version) ||
    Number(x.version) < 1 ||
    !iso(x.updatedAt) ||
    (requireChanged && typeof x.changed !== "boolean") ||
    (!requireChanged && x.changed !== undefined && typeof x.changed !== "boolean")
  )
    return invalid();
  return {
    id: String(x.id),
    slug: x.slug,
    status: x.status as ProductStatus,
    version: Number(x.version),
    updatedAt: x.updatedAt,
    ...(x.changed === undefined ? {} : { changed: x.changed as boolean }),
  };
}

export const productLifecycleService = {
  async get(productId: string) {
    return parseProductLifecycleState(await apiFetch<unknown>(`/seller/products/${productId}`));
  },
  async transition(productId: string, action: ProductLifecycleAction, expectedVersion: number) {
    return parseProductLifecycleState(
      await apiFetch<unknown>(`/seller/products/${productId}/lifecycle`, {
        method: "PATCH",
        body: JSON.stringify({ action, expectedVersion }),
      }),
      true,
    );
  },
};
