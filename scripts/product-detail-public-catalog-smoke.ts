import { validateInfraSmokeTarget } from "./infra-smoke-guard.mjs";
import { parsePublicCatalogDetailResponse } from "../src/services/publicCatalog/parser";

const base = validateInfraSmokeTarget({
  baseUrl:
    process.env.PRODUCT_DETAIL_PUBLIC_CATALOG_SMOKE_BASE_URL ?? "http://localhost:13001/api/v1",
});
const origin = validateInfraSmokeTarget({
  baseUrl: process.env.PRODUCT_DETAIL_PUBLIC_CATALOG_SMOKE_ORIGIN ?? "http://localhost:13000",
});
if (base.pathname.replace(/\/$/, "") !== "/api/v1" || origin.pathname !== "/")
  throw new Error("Invalid product detail smoke target");
const forbidden = new Set([
  "objectKey",
  "sourceListingDraftId",
  "sellerProfileId",
  "categoryId",
  "subcategoryId",
  "userId",
  "email",
  "phone",
  "version",
  "autoMessage",
  "buyerRequirements",
  "notes",
  "accountDetails",
  "rejectionCode",
  "rejectionReason",
  "accessToken",
  "refreshToken",
  "csrf",
  "password",
  "hash",
  "stack",
]);
function inspect(value: unknown): void {
  if (typeof value === "string" && value.toLowerCase().includes("minio:9000"))
    throw new Error("Private infrastructure exposed");
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (forbidden.has(key)) throw new Error("Private field exposed");
    inspect(nested);
  }
}
async function raw(slug: string): Promise<{ response: Response; payload: unknown }> {
  const url = new URL(
    `${base.pathname.replace(/\/$/, "")}/catalog/products/${encodeURIComponent(slug)}`,
    base.origin,
  );
  const response = await fetch(url, { headers: { Origin: origin.origin } });
  return { response, payload: (await response.json()) as unknown };
}
const expected = [
  ["demo-conta-jogo", "ACCOUNT", "NORMAL", "FIXED", "49.90", 10, "MANUAL"],
  ["demo-gift-card-steam-100", "GIFT_CARD", "NORMAL", "FIXED", "100.00", 10],
  ["demo-moedas-virtuais", "VIRTUAL_CURRENCY", "DYNAMIC", "FROM", "9.90", 60],
  ["demo-licenca-digital", "SOFTWARE", "DYNAMIC", "FROM", "29.90", 75],
  ["demo-servico-acompanhamento", "SERVICE", "SERVICE", "FIXED", "79.90", null],
  ["demo-servico-personalizado", "SERVICE", "SERVICE", "QUOTE", null, null],
] as const;
let imageUrl: string | undefined;
for (const [slug, type, model, kind, amount, stock, delivery] of expected) {
  const result = await raw(slug);
  if (result.response.status !== 200) throw new Error("Expected public detail HTTP 200");
  inspect(result.payload);
  const product = parsePublicCatalogDetailResponse(result.payload);
  if (
    product.productType !== type ||
    product.model !== model ||
    product.pricing.kind !== kind ||
    product.pricing.amount !== amount ||
    product.stock !== stock ||
    (delivery && product.deliveryMode !== delivery)
  )
    throw new Error("Unexpected public detail contract");
  if (product.gallery.filter((image) => image.isCover).length !== 1)
    throw new Error("Invalid gallery cover");
  imageUrl ??= product.gallery[0]?.url;
}
for (const slug of ["demo-produto-pausado", "demo-produto-nao-publicado", "produto-inexistente"]) {
  const result = await raw(slug);
  const body = result.payload as { code?: unknown };
  if (result.response.status !== 404 || body.code !== "PRODUCT_NOT_FOUND")
    throw new Error("Hidden product was distinguishable");
}
if (!imageUrl || !(await fetch(imageUrl)).ok) throw new Error("Signed image download failed");
process.stdout.write(
  `${JSON.stringify({ ok: true, publicDetails: 6, normal: 2, dynamic: 2, services: 2, hiddenNotFound: 3, signedImageDownload: true })}\n`,
);
