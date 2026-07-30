import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

export const requiredFiles = [
  "HOME_PUBLIC_CATALOG_INTEGRATION.md",
  "CATEGORY_PUBLIC_CATALOG_INTEGRATION.md",
  "PRODUCT_DETAIL_PUBLIC_CATALOG_INTEGRATION.md",
  "LOCAL_DEMO_DATA.md",
  "LOCAL_PUBLIC_FOUNDATION_RUNBOOK.md",
  "PUBLIC_FOUNDATION_FINAL_AUDIT.md",
];
export const currentDocs = [
  "README.md",
  "DEVELOPER_HANDOFF.md",
  "SERVICES_MAP.md",
  "MOCKS_INVENTORY.md",
  "BACKEND_ROADMAP.md",
  "HANDOFF_CHECKLIST.md",
  "LOCAL_DEMO_DATA.md",
  "HOME_PUBLIC_CATALOG_INTEGRATION.md",
  "CATEGORY_PUBLIC_CATALOG_INTEGRATION.md",
  "PRODUCT_DETAIL_PUBLIC_CATALOG_INTEGRATION.md",
  "PUBLIC_CATALOG_READ_FOUNDATION.md",
  "PUBLIC_FOUNDATION_FINAL_AUDIT.md",
  "ROUTES_MAP.md",
];
const historicalDocs = ["MVP_STATUS.md", "PRE_HANDOFF_AUDIT.md"];
const requiredScripts = [
  "demo:prepare",
  "demo:check",
  "demo:ci:public-foundation",
  "audit:public-foundation",
  "smoke:home-catalog",
  "smoke:category-catalog",
  "smoke:product-detail-catalog",
  "demo:seed",
  "demo:verify",
  "demo:reset",
];
const stalePatterns: [string, RegExp][] = [
  ["backend-missing", /(?:não|sem) (?:existe |possui )?backend/i],
  [
    "database-missing",
    /(?:não existe|não possui|sem) (?:um )?(?:backend de )?(?:banco de dados|banco real)/i,
  ],
  ["auth-mocked", /autenticação (?:é |está )?(?:100%|totalmente) mock/i],
  ["any-password", /qualquer (?:e-mail|email).{0,40}senha|senha qualquer/i],
  ["all-services-mocked", /todos os services (?:são|estão) mock/i],
  [
    "home-only",
    /publicCatalogService.{0,60}(?:consumido|usado).{0,30}(?:somente|apenas).{0,15}(?:Home|`\/`)/i,
  ],
  [
    "category-disconnected",
    /(?:rota )?`?\/categoria\/\$slug`?.{0,50}(?:desconectad|mockad|futur)/i,
  ],
  [
    "detail-disconnected",
    /(?:rota )?`?\/produto\/\$id`?.{0,50}(?:desconectad|mockad|futur)|detalhe público.{0,30}(?:desconectad|mockad|futur)/i,
  ],
  ["cards-unlinked", /cards públicos.{0,40}(?:sem link|não possuem link)/i],
  ["backend-undefined", /(?:definir|escolher) stack de backend/i],
  ["supabase-assumed", /Supabase assumid/i],
  ["product-storage-future", /storage (?:S3[^\n]*|de produto[^\n]*)(?:completamente )?futur/i],
];

export function audit(root: string) {
  const base = resolve(root);
  const read = (path: string) => {
    const full = resolve(base, path);
    const rel = relative(base, full);
    if (rel.startsWith("..") || rel === "") throw new Error("AUDIT_ROOT_ESCAPE");
    return existsSync(full) ? readFileSync(full, "utf8") : "";
  };
  const failures: string[] = [];
  for (const file of [...requiredFiles, ...currentDocs, ...historicalDocs])
    if (!existsSync(resolve(base, file))) failures.push(`missing:${file}`);
  const home = read("src/routes/index.tsx"),
    category = read("src/routes/categoria.$slug.tsx"),
    detail = read("src/routes/produto.$id.tsx"),
    card = read("src/components/public-catalog/PublicCatalogCard.tsx");
  if (!home.includes("publicCatalogService")) failures.push("home:catalog");
  if (category.includes("services/productService")) failures.push("category:legacy");
  if (detail.includes("productService") || detail.includes("reviewService"))
    failures.push("detail:legacy");
  if (!detail.includes("publicCatalogService")) failures.push("detail:catalog");
  for (const token of ["Link", 'to="/produto/$id"', "product.slug"])
    if (!card.includes(token)) failures.push(`card:${token}`);
  const pkg = JSON.parse(read("package.json"));
  for (const script of requiredScripts)
    if (!pkg.scripts?.[script]) failures.push(`script:${script}`);
  const down = String(pkg.scripts?.["demo:down"] ?? "");
  if (/(?:^|\s)(?:-v|--volumes)(?:\s|$)/.test(down)) failures.push("demo:down:volumes");
  const rehearsal = read("scripts/public-foundation-rehearsal.ts");
  if (rehearsal.includes('["curl"') || rehearsal.includes("'curl'"))
    failures.push("rehearsal:curl");
  for (const name of ["INFRA_SMOKE_BASE_URL", "INFRA_SMOKE_ORIGIN"])
    if (!rehearsal.includes(name)) failures.push(`check:${name}`);
  const ci = read(".github/workflows/ci.yml");
  for (const command of ["demo:prepare", "demo:check", "demo:ci:public-foundation"])
    if (!ci.includes(`bun run ${command}`)) failures.push(`ci:${command}`);
  if (["demo:seed", "smoke:home-catalog", "demo:reset"].every((s) => ci.includes(`bun run ${s}`)))
    failures.push("ci:duplicate");
  let staleCurrentClaims = 0;
  for (const file of currentDocs) {
    const text = read(file);
    for (const [name, pattern] of stalePatterns)
      if (pattern.test(text)) {
        failures.push(`stale:${file}:${name}`);
        staleCurrentClaims++;
      }
  }
  for (const file of historicalDocs) {
    const text = read(file);
    if (!/snapshot histórico/i.test(text) || !text.includes("PUBLIC_FOUNDATION_FINAL_AUDIT.md"))
      failures.push(`historical-unmarked:${file}`);
  }
  return {
    ok: failures.length === 0,
    requiredFiles: requiredFiles.length,
    realPublicRoutes: 3,
    publicSmokes: 3,
    legacyServiceLeaks: failures.filter((f) => f.includes(":legacy")).length,
    staleCurrentClaims,
    failures,
  };
}
if (import.meta.main) {
  const result = audit(import.meta.dir + "/..");
  console.log(JSON.stringify(result));
  if (!result.ok) process.exit(1);
}
