import { validateInfraSmokeTarget } from "./infra-smoke-guard.mjs";
import { parsePublicCatalogListResponse } from "../src/services/publicCatalog/parser";

const baseUrl = process.env.HOME_PUBLIC_CATALOG_SMOKE_BASE_URL ?? "http://localhost:13001/api/v1";
const origin = process.env.HOME_PUBLIC_CATALOG_SMOKE_ORIGIN ?? "http://localhost:13000";
const target = validateInfraSmokeTarget({ baseUrl });
const allowedOrigin = validateInfraSmokeTarget({ baseUrl: origin });

if (target.pathname.replace(/\/$/, "") !== "/api/v1")
  throw new Error("Smoke base URL must target /api/v1");
if (allowedOrigin.pathname !== "/" || allowedOrigin.search || allowedOrigin.hash)
  throw new Error("Smoke origin must contain only scheme, host and port");

const endpoint = new URL(`${target.pathname.replace(/\/$/, "")}/catalog/products`, target.origin);
endpoint.search = new URLSearchParams({ sort: "RECENT", page: "1", limit: "8" }).toString();

const response = await fetch(endpoint, {
  method: "GET",
  headers: { Origin: allowedOrigin.origin },
});
if (response.status !== 200)
  throw new Error(`Catalog smoke expected HTTP 200, received ${response.status}`);
if (response.headers.get("access-control-allow-origin") !== allowedOrigin.origin)
  throw new Error("Catalog smoke received an unexpected CORS origin");

const raw: unknown = await response.json();
assertNoPrivateFields(raw);
const catalog = parsePublicCatalogListResponse(raw);
if (catalog.pagination.page !== 1 || catalog.pagination.limit !== 8)
  throw new Error("Catalog smoke received unexpected pagination");
if (catalog.items.length !== 6) throw new Error("Catalog smoke expected exactly six products");

const activeSlugs = new Set([
  "demo-conta-jogo",
  "demo-gift-card-steam-100",
  "demo-moedas-virtuais",
  "demo-licenca-digital",
  "demo-servico-acompanhamento",
  "demo-servico-personalizado",
]);
const returnedSlugs = new Set(catalog.items.map((item) => item.slug));
for (const slug of activeSlugs)
  if (!returnedSlugs.has(slug)) throw new Error("Catalog smoke is missing an active demo product");
for (const slug of ["demo-produto-pausado", "demo-produto-nao-publicado"])
  if (returnedSlugs.has(slug)) throw new Error("Catalog smoke exposed a hidden demo product");

const pricingKinds = new Set(catalog.items.map((item) => item.pricing.kind));
for (const kind of ["FIXED", "FROM", "QUOTE"] as const)
  if (!pricingKinds.has(kind)) throw new Error(`Catalog smoke is missing ${kind} pricing`);

const signedImage = catalog.items.find((item) => isSignedUrl(item.coverImage.url));
if (!signedImage || !catalog.items.every((item) => isSignedUrl(item.coverImage.url)))
  throw new Error("Catalog smoke expected signed image URLs");
const imageResponse = await fetch(signedImage.coverImage.url, {
  method: "GET",
  headers: { Origin: allowedOrigin.origin },
});
if (!imageResponse.ok)
  throw new Error(`Catalog smoke image download failed with HTTP ${imageResponse.status}`);
await imageResponse.arrayBuffer();

process.stdout.write(
  `${JSON.stringify({ ok: true, products: 6, fixed: true, from: true, quote: true, imageDownload: true })}\n`,
);

function isSignedUrl(value: string): boolean {
  const url = new URL(value);
  const keys = new Set([...url.searchParams.keys()].map((key) => key.toLowerCase()));
  return keys.has("x-amz-signature") || keys.has("signature");
}

function assertNoPrivateFields(value: unknown): void {
  const forbidden =
    /^(objectkey|password|passwordhash|accesstoken|refreshtoken|secret|credentials?|draft|draftid|sourcelistingdraftid|userid|email|phone|document|accountdetails?|internal)$/i;
  if (Array.isArray(value)) return value.forEach(assertNoPrivateFields);
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (forbidden.test(key)) throw new Error("Catalog smoke exposed a private or internal field");
    assertNoPrivateFields(child);
  }
}
