import { validateInfraSmokeTarget } from "./infra-smoke-guard.mjs";
import { parsePublicCatalogListResponse } from "../src/services/publicCatalog/parser";
import {
  parsePublicCategoryResponse,
  parsePublicSubcategoryListResponse,
} from "../src/services/catalog/publicTaxonomyParser";

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
async function get(path: string): Promise<unknown> {
  const url = new URL(`${base.pathname.replace(/\/$/, "")}${path}`, base.origin);
  const response = await fetch(url, { headers: { Origin: origin.origin } });
  if (response.status !== 200)
    throw new Error(`Category contract expected HTTP 200, received ${response.status}`);
  if (response.headers.get("access-control-allow-origin") !== origin.origin)
    throw new Error("Unexpected CORS origin");
  return response.json() as Promise<unknown>;
}
const category = parsePublicCategoryResponse(await get("/catalog/categories/demo-jogos"));
if (category.slug !== "demo-jogos" || category.name !== "Jogos — Demonstração")
  throw new Error("Unexpected public category contract");
const subcategories = parsePublicSubcategoryListResponse(
  await get("/catalog/categories/demo-jogos/subcategories"),
);
const expectedSubcategories = ["demo-contas", "demo-moedas", "demo-itens", "demo-servicos"];
if (
  subcategories.length !== expectedSubcategories.length ||
  new Set(subcategories.map((item) => item.slug)).size !== expectedSubcategories.length ||
  !expectedSubcategories.every((slug) => subcategories.some((item) => item.slug === slug))
)
  throw new Error("Unexpected public subcategory contract");
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
const expectedOrders = {
  RECENT: [
    "demo-servico-personalizado",
    "demo-servico-acompanhamento",
    "demo-moedas-virtuais",
    "demo-conta-jogo",
  ],
  OLDEST: [
    "demo-conta-jogo",
    "demo-moedas-virtuais",
    "demo-servico-acompanhamento",
    "demo-servico-personalizado",
  ],
  TITLE_ASC: [
    "demo-conta-jogo",
    "demo-moedas-virtuais",
    "demo-servico-acompanhamento",
    "demo-servico-personalizado",
  ],
  TITLE_DESC: [
    "demo-servico-personalizado",
    "demo-servico-acompanhamento",
    "demo-moedas-virtuais",
    "demo-conta-jogo",
  ],
} as const;
for (const [sort, expected] of Object.entries(expectedOrders)) {
  const ordered = await list({ categorySlug: "demo-jogos", sort, page: "1", limit: "50" });
  const slugs = ordered.items.map((item) => item.slug);
  if (new Set(slugs).size !== slugs.length || slugs.join("|") !== expected.join("|"))
    throw new Error(`Unexpected ${sort} order`);
}
const first = await list({ categorySlug: "demo-jogos", sort: "TITLE_ASC", page: "1", limit: "1" });
const second = await list({ categorySlug: "demo-jogos", sort: "TITLE_ASC", page: "2", limit: "1" });
const fourth = await list({ categorySlug: "demo-jogos", sort: "TITLE_ASC", page: "4", limit: "1" });
if (
  first.items.length !== 1 ||
  !first.pagination.hasNext ||
  second.items.length !== 1 ||
  fourth.items.length !== 1 ||
  first.items[0]?.slug !== "demo-conta-jogo" ||
  first.pagination.page !== 1 ||
  first.pagination.limit !== 1 ||
  second.items[0]?.slug !== "demo-moedas-virtuais" ||
  second.pagination.page !== 2 ||
  second.pagination.limit !== 1 ||
  !second.pagination.hasNext ||
  fourth.items[0]?.slug !== "demo-servico-personalizado" ||
  fourth.pagination.page !== 4 ||
  fourth.pagination.limit !== 1 ||
  fourth.pagination.hasNext
)
  throw new Error("Unexpected deterministic pagination");
const returned = new Set(
  [...games.items, ...gift.items, ...software.items].map((item) => item.slug),
);
if (returned.has("demo-produto-pausado") || returned.has("demo-produto-nao-publicado"))
  throw new Error("Hidden product exposed");
process.stdout.write(
  `${JSON.stringify({ ok: true, category: true, subcategories: 4, exactOrders: 4, deterministicPages: 3, publicProducts: 6, hiddenProducts: false })}\n`,
);
