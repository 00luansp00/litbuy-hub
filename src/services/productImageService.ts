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
export function validateProductImage(file: Pick<File, "type" | "size">, occupied: number) {
  if (!PRODUCT_IMAGE_TYPES.includes(file.type as (typeof PRODUCT_IMAGE_TYPES)[number]))
    throw new Error("Tipo de imagem não permitido.");
  if (file.size <= 0 || file.size > PRODUCT_IMAGE_MAX_BYTES)
    throw new Error("A imagem deve ter no máximo 5 MB.");
  if (occupied >= PRODUCT_IMAGE_LIMIT) throw new Error("Limite de oito imagens atingido.");
}
const path = (productId: string) => `/seller/products/${productId}/images`;
export const productImageService = {
  list: (id: string) => apiFetch<{ items: ProductImage[]; limit: number }>(path(id)),
  intent: (id: string, file: File) =>
    apiFetch<{ imageId: string; uploadUrl: string; headers: Record<string, string> }>(
      `${path(id)}/upload-intents`,
      { method: "POST", body: JSON.stringify({ contentType: file.type, sizeBytes: file.size }) },
    ),
  complete: (p: string, i: string) =>
    apiFetch<ProductImage>(`${path(p)}/${i}/complete`, { method: "POST" }),
  cover: (p: string, i: string) =>
    apiFetch<ProductImage>(`${path(p)}/${i}/cover`, { method: "PATCH" }),
  reorder: (p: string, ids: string[]) =>
    apiFetch(`${path(p)}/reorder`, { method: "PATCH", body: JSON.stringify({ imageIds: ids }) }),
  remove: (p: string, i: string) => apiFetch(`${path(p)}/${i}`, { method: "DELETE" }),
  async upload(productId: string, file: File, onProgress?: (value: number) => void) {
    validateProductImage(file, 0);
    const intent = await this.intent(productId, file);
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
      throw new Error("Upload enviado, mas a confirmação falhou. Tente novamente.");
    }
  },
};
