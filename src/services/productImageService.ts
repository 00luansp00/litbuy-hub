import { apiFetch } from "@/lib/api/client";
export const PRODUCT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const PRODUCT_IMAGE_LIMIT = 8;
export type ProductImage = {
  id: string;
  status: "PENDING_UPLOAD" | "READY";
  contentType: string;
  sizeBytes: number;
  altText: string | null;
  sortOrder: number;
  isCover: boolean;
  uploadedAt: string | null;
  createdAt: string;
  viewUrl: string | null;
  viewExpiresAt: string | null;
};
type Intent = {
  imageId: string;
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt: string;
};
export class ProductImagePayloadError extends Error {
  code = "PRODUCT_IMAGE_RESPONSE_INVALID";
}
export class ProductImageConfirmationError extends Error {
  constructor(public readonly imageId: string) {
    super("Upload enviado, mas a confirmação falhou. Tente confirmar novamente.");
  }
}
const invalid = (): never => {
  throw new ProductImagePayloadError("Resposta de imagens inválida.");
};
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isIso = (value: unknown): value is string =>
  typeof value === "string" &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString() === value;
const isUrl = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};
export function parseProductImage(value: unknown): ProductImage {
  if (!value || typeof value !== "object") return invalid();
  const x = value as Record<string, unknown>;
  const ready = x.status === "READY",
    pending = x.status === "PENDING_UPLOAD";
  if (
    !uuidV4.test(String(x.id)) ||
    (!ready && !pending) ||
    !PRODUCT_IMAGE_TYPES.includes(x.contentType as (typeof PRODUCT_IMAGE_TYPES)[number]) ||
    !Number.isInteger(x.sizeBytes) ||
    Number(x.sizeBytes) <= 0 ||
    !Number.isInteger(x.sortOrder) ||
    Number(x.sortOrder) < 0 ||
    typeof x.isCover !== "boolean" ||
    !(x.altText === null || typeof x.altText === "string") ||
    !isIso(x.createdAt) ||
    !(x.uploadedAt === null || isIso(x.uploadedAt))
  )
    return invalid();
  if (ready && (!isUrl(x.viewUrl) || !isIso(x.viewExpiresAt) || !isIso(x.uploadedAt)))
    return invalid();
  if (
    pending &&
    (x.viewUrl !== null || x.viewExpiresAt !== null || x.uploadedAt !== null || x.isCover !== false)
  )
    return invalid();
  return {
    id: String(x.id),
    status: x.status as ProductImage["status"],
    contentType: x.contentType as ProductImage["contentType"],
    sizeBytes: Number(x.sizeBytes),
    altText: x.altText as string | null,
    sortOrder: Number(x.sortOrder),
    isCover: x.isCover,
    uploadedAt: x.uploadedAt as string | null,
    createdAt: x.createdAt,
    viewUrl: x.viewUrl as string | null,
    viewExpiresAt: x.viewExpiresAt as string | null,
  };
}
export function parseImageList(value: unknown) {
  if (!value || typeof value !== "object") return invalid();
  const x = value as { items?: unknown; limit?: unknown };
  if (!Array.isArray(x.items) || x.limit !== PRODUCT_IMAGE_LIMIT) return invalid();
  return { items: x.items.map(parseProductImage), limit: PRODUCT_IMAGE_LIMIT };
}
export function parseIntent(value: unknown): Intent {
  if (!value || typeof value !== "object") return invalid();
  const x = value as Record<string, unknown>;
  if (
    !uuidV4.test(String(x.imageId)) ||
    !isUrl(x.uploadUrl) ||
    !isIso(x.expiresAt) ||
    !x.headers ||
    typeof x.headers !== "object" ||
    Array.isArray(x.headers)
  )
    return invalid();
  const entries = Object.entries(x.headers);
  if (entries.some(([, v]) => typeof v !== "string")) return invalid();
  const headers = Object.fromEntries(entries) as Record<string, string>;
  if (
    !PRODUCT_IMAGE_TYPES.includes(
      headers["Content-Type"] as (typeof PRODUCT_IMAGE_TYPES)[number],
    ) ||
    headers["If-None-Match"] !== "*"
  )
    return invalid();
  return { imageId: String(x.imageId), uploadUrl: x.uploadUrl, headers, expiresAt: x.expiresAt };
}
export function validateProductImage(file: Pick<File, "type" | "size">, occupied: number) {
  if (!PRODUCT_IMAGE_TYPES.includes(file.type as (typeof PRODUCT_IMAGE_TYPES)[number]))
    throw new Error("Tipo de imagem não permitido.");
  if (file.size <= 0 || file.size > PRODUCT_IMAGE_MAX_BYTES)
    throw new Error("A imagem deve ter no máximo 5 MB.");
  if (occupied >= PRODUCT_IMAGE_LIMIT) throw new Error("Limite de oito imagens atingido.");
}
const path = (productId: string) => `/seller/products/${productId}/images`;
export const productImageService = {
  async list(id: string) {
    return parseImageList(await apiFetch<unknown>(path(id)));
  },
  async intent(id: string, file: File, altText?: string) {
    return parseIntent(
      await apiFetch<unknown>(`${path(id)}/upload-intents`, {
        method: "POST",
        body: JSON.stringify({
          contentType: file.type,
          sizeBytes: file.size,
          altText: altText || undefined,
        }),
      }),
    );
  },
  async complete(p: string, i: string) {
    return parseProductImage(
      await apiFetch<unknown>(`${path(p)}/${i}/complete`, { method: "POST" }),
    );
  },
  async cover(p: string, i: string) {
    return parseProductImage(await apiFetch<unknown>(`${path(p)}/${i}/cover`, { method: "PATCH" }));
  },
  async reorder(p: string, ids: string[]) {
    return parseImageList(
      await apiFetch<unknown>(`${path(p)}/reorder`, {
        method: "PATCH",
        body: JSON.stringify({ imageIds: ids }),
      }),
    );
  },
  remove: (p: string, i: string) => apiFetch(`${path(p)}/${i}`, { method: "DELETE" }),
  async upload(
    productId: string,
    file: File,
    onProgress?: (value: number) => void,
    altText?: string,
  ) {
    validateProductImage(file, 0);
    const intent = await this.intent(productId, file, altText);
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", intent.uploadUrl);
      Object.entries(intent.headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
      xhr.upload.onprogress = (e) =>
        e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new Error("Falha no envio ao storage."));
      xhr.onerror = () => reject(new Error("Falha no envio ao storage."));
      xhr.send(file);
    });
    try {
      return await this.complete(productId, intent.imageId);
    } catch {
      throw new ProductImageConfirmationError(intent.imageId);
    }
  },
};
