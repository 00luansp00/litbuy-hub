import { validateInfraSmokeTarget } from "./infra-smoke-guard.mjs";
import { parsePublicCatalogListResponse } from "../src/services/publicCatalog/parser";

const base = validateInfraSmokeTarget({
  baseUrl: process.env.CATEGORY_PUBLIC_CATALOG_SMOKE_BASE_URL ?? "http://localhost:13001/api/v1",
});
const origin = validateInfraSmokeTarget({
  baseUrl: process.env.CATEGORY_PUBLIC_CATALOG_SMOKE_ORIGIN ?? "http://localhost:13000",
});
if (base.pathname.replace(/\/$/, "") !== "/api/v1" || origin.pathname !== "/")
  throw new Error("Invalid category smoke target");
async function list(query: Record<string, string>) {
  const url = new URL(`${base.pathname.replace(/\/$/, "")}/catalog/products`, base.origin);
  url.search = new URLSearchParams(query).toString();
  const response = await fetch(url, { headers: { Origin: origin.origin } });
  if (response.status !== 200)
    throw new Error(`Category catalog expected HTTP 200, received ${response.status}`);
  if (response.headers.get("access-control-allow-origin") !== origin.origin)
    throw new Error("Unexpected CORS origin");
  return parsePublicCatalogListResponse(await response.json());
}
const defaults = { sort: "TITLE_ASC", page: "1", limit: "50" };
const games = await list({ ...defaults, categorySlug: "demo-jogos" });
if (games.items.length !== 4) throw new Error("Expected four public games products");
const types = games.items.map((item) => item.productType).sort();
if (types.join(",") !== ["ACCOUNT", "SERVICE", "SERVICE", "VIRTUAL_CURRENCY"].sort().join(","))
  throw new Error("Unexpected game product types");
const gift = await list({ ...defaults, categorySlug: "demo-gift-cards" });
if (gift.items.length !== 1 || gift.items[0].slug !== "demo-gift-card-steam-100")
  throw new Error("Unexpected gift card catalog");
const software = await list({ ...defaults, categorySlug: "demo-software" });
if (software.items.length !== 1 || software.items[0].slug !== "demo-licenca-digital")
  throw new Error("Unexpected software catalog");
const services = await list({
  ...defaults,
  categorySlug: "demo-jogos",
  subcategorySlug: "demo-servicos",
});
if (
  services.items.length !== 2 ||
  services.items.some(
    (item) => item.productType !== "SERVICE" || item.subcategory?.slug !== "demo-servicos",
  )
)
  throw new Error("Unexpected services subcategory");
if (
  (await list({ ...defaults, categorySlug: "demo-jogos", subcategorySlug: "demo-itens" })).items
    .length !== 0
)
  throw new Error("Expected empty items subcategory");
if (
  (await list({ ...defaults, categorySlug: "demo-jogos", productType: "SERVICE" })).items.length !==
  2
)
  throw new Error("Unexpected type filter");
for (const sort of ["RECENT", "OLDEST", "TITLE_ASC", "TITLE_DESC"])
  await list({ categorySlug: "demo-jogos", sort, page: "1", limit: "50" });
const first = await list({ categorySlug: "demo-jogos", sort: "TITLE_ASC", page: "1", limit: "1" });
const second = await list({ categorySlug: "demo-jogos", sort: "TITLE_ASC", page: "2", limit: "1" });
if (
  first.items.length !== 1 ||
  !first.pagination.hasNext ||
  second.items.length !== 1 ||
  first.items[0].id === second.items[0].id
)
  throw new Error("Unexpected deterministic pagination");
const returned = new Set(
  [...games.items, ...gift.items, ...software.items].map((item) => item.slug),
);
if (returned.has("demo-produto-pausado") || returned.has("demo-produto-nao-publicado"))
  throw new Error("Hidden product exposed");
process.stdout.write(`${JSON.stringify({ ok: true, scenarios: 11, publicProducts: 6 })}\n`);
