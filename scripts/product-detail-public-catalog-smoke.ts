import { validateInfraSmokeTarget } from "./infra-smoke-guard.mjs";
import { parsePublicCatalogDetailResponse } from "../src/services/publicCatalog/parser";
import type { PublicCatalogProductDetail } from "../src/services/publicCatalog/types";

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
async function request(slug: string): Promise<{ response: Response; payload: unknown }> {
  const url = new URL(
    `${base.pathname.replace(/\/$/, "")}/catalog/products/${encodeURIComponent(slug)}`,
    base.origin,
  );
  const response = await fetch(url, { headers: { Origin: origin.origin } });
  if (response.headers.get("access-control-allow-origin") !== origin.origin)
    throw new Error("Unexpected product detail CORS origin");
  const payload = (await response.json()) as unknown;
  inspect(payload);
  return { response, payload };
}
const expected = [
  {
    slug: "demo-conta-jogo",
    type: "ACCOUNT",
    model: "NORMAL",
    kind: "FIXED",
    amount: "49.90",
    stock: 10,
    variants: [["Opção única", "49.90", 10]],
  },
  {
    slug: "demo-gift-card-steam-100",
    type: "GIFT_CARD",
    model: "NORMAL",
    kind: "FIXED",
    amount: "100.00",
    stock: 10,
    variants: [["R$ 100", "100.00", 20]],
  },
  {
    slug: "demo-moedas-virtuais",
    type: "VIRTUAL_CURRENCY",
    model: "DYNAMIC",
    kind: "FROM",
    amount: "9.90",
    stock: 60,
    variants: [
      ["Pacote pequeno", "9.90", 30],
      ["Pacote médio", "19.90", 20],
      ["Pacote grande", "39.90", 10],
    ],
  },
  {
    slug: "demo-licenca-digital",
    type: "SOFTWARE",
    model: "DYNAMIC",
    kind: "FROM",
    amount: "29.90",
    stock: 75,
    variants: [
      ["Mensal", "29.90", 50],
      ["Anual", "199.90", 25],
    ],
  },
  {
    slug: "demo-servico-acompanhamento",
    type: "SERVICE",
    model: "SERVICE",
    kind: "FIXED",
    amount: "79.90",
    stock: null,
    variants: [["Sessão", "79.90", 1]],
    service: ["FIXED", "79.90", "Até 2 dias úteis"],
  },
  {
    slug: "demo-servico-personalizado",
    type: "SERVICE",
    model: "SERVICE",
    kind: "QUOTE",
    amount: null,
    stock: null,
    variants: [],
    service: ["QUOTE", null, "Até 2 dias úteis"],
  },
] as const;
let imageUrl: string | undefined;
for (const item of expected) {
  const result = await request(item.slug);
  if (result.response.status !== 200) throw new Error("Expected public detail HTTP 200");
  const product = parsePublicCatalogDetailResponse(result.payload);
  if (
    product.slug !== item.slug ||
    product.productType !== item.type ||
    product.model !== item.model ||
    product.pricing.kind !== item.kind ||
    product.pricing.amount !== item.amount ||
    product.stock !== item.stock ||
    product.seller.slug !== "demo-lit-store" ||
    product.deliveryMode !== "MANUAL"
  )
    throw new Error("Unexpected public detail contract");
  const variants = product.variants.map(({ title, price, stock }) => [title, price, stock]);
  if (JSON.stringify(variants) !== JSON.stringify(item.variants))
    throw new Error("Unexpected public variant order or values");
  if (item.service) {
    const service = product.serviceDetails;
    if (
      !service ||
      JSON.stringify([service.pricingType, service.basePrice, service.estimatedDelivery]) !==
        JSON.stringify(item.service)
    )
      throw new Error("Unexpected public service details");
  } else if (product.serviceDetails !== null) throw new Error("Unexpected service details");
  assertGallery(product);
  imageUrl ??= product.gallery[0]?.url;
}
function assertGallery(product: PublicCatalogProductDetail): void {
  if (
    product.gallery.length === 0 ||
    product.gallery.filter((image) => image.isCover).length !== 1 ||
    new Set(product.gallery.map((image) => image.id)).size !== product.gallery.length ||
    new Set(product.gallery.map((image) => image.url)).size !== product.gallery.length
  )
    throw new Error("Invalid public gallery");
  const cover = product.gallery.find((image) => image.isCover)!;
  if (
    cover.url !== product.coverImage.url ||
    cover.expiresAt !== product.coverImage.expiresAt ||
    cover.altText !== product.coverImage.altText
  )
    throw new Error("Public cover mismatch");
}
let hiddenResponse: string | undefined;
for (const slug of ["demo-produto-pausado", "demo-produto-nao-publicado", "produto-inexistente"]) {
  const result = await request(slug);
  const body = result.payload as { code?: unknown };
  if (result.response.status !== 404 || body.code !== "PRODUCT_NOT_FOUND")
    throw new Error("Hidden product was distinguishable");
  const bodyRecord = result.payload as { statusCode?: unknown; code?: unknown; message?: unknown };
  const publicError = JSON.stringify({
    statusCode: bodyRecord.statusCode,
    code: bodyRecord.code,
    message: bodyRecord.message,
  });
  hiddenResponse ??= publicError;
  if (publicError !== hiddenResponse) throw new Error("Hidden not-found responses differ");
}
if (!imageUrl) throw new Error("Signed image missing");
const imageResponse = await fetch(imageUrl, { headers: { Origin: origin.origin } });
if (!imageResponse.ok || imageResponse.headers.get("access-control-allow-origin") !== origin.origin)
  throw new Error("Signed image download or CORS failed");
process.stdout.write(
  `${JSON.stringify({ ok: true, publicDetails: 6, normal: 2, dynamic: 2, services: 2, hiddenNotFound: 3, signedImageDownload: true })}\n`,
);
