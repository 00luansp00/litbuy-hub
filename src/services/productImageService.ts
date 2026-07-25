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
  viewUrl: string | null;
  viewExpiresAt: string | null;
};
type Intent = { imageId: string; uploadUrl: string; headers: Record<string, string> };
export class ProductImagePayloadError extends Error {
  code = "PRODUCT_IMAGE_RESPONSE_INVALID";
}
export class ProductImageConfirmationError extends Error {
  constructor(public readonly imageId: string) {
    super("Upload enviado, mas a confirmação falhou. Tente confirmar novamente.");
  }
}
const invalid = () => {
  throw new ProductImagePayloadError("Resposta de imagens inválida.");
};
export function parseProductImage(value: unknown): ProductImage {
  if (!value || typeof value !== "object") return invalid();
  const x = value as Record<string, unknown>;
  if (
    typeof x.id !== "string" ||
    !["PENDING_UPLOAD", "READY"].includes(String(x.status)) ||
    typeof x.contentType !== "string" ||
    typeof x.sizeBytes !== "number" ||
    typeof x.sortOrder !== "number" ||
    typeof x.isCover !== "boolean" ||
    !(x.viewUrl === null || typeof x.viewUrl === "string") ||
    !(x.viewExpiresAt === null || typeof x.viewExpiresAt === "string")
  )
    return invalid();
  return x as ProductImage;
}
export function parseImageList(value: unknown) {
  if (!value || typeof value !== "object") return invalid();
  const x = value as { items?: unknown; limit?: unknown };
  if (!Array.isArray(x.items) || typeof x.limit !== "number") return invalid();
  return { items: x.items.map(parseProductImage), limit: x.limit };
}
export function parseIntent(value: unknown): Intent {
  if (!value || typeof value !== "object") return invalid();
  const x = value as Record<string, unknown>;
  if (
    typeof x.imageId !== "string" ||
    typeof x.uploadUrl !== "string" ||
    !x.headers ||
    typeof x.headers !== "object"
  )
    return invalid();
  const headers = Object.fromEntries(
    Object.entries(x.headers).map(([k, v]) => (typeof v === "string" ? [k, v] : invalid())),
  );
  return { imageId: x.imageId, uploadUrl: x.uploadUrl, headers };
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
