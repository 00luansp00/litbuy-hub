import { readFileSync, existsSync } from "node:fs";
import { resolve, relative } from "node:path";

export const requiredFiles = [
  "HOME_PUBLIC_CATALOG_INTEGRATION.md",
  "CATEGORY_PUBLIC_CATALOG_INTEGRATION.md",
  "PRODUCT_DETAIL_PUBLIC_CATALOG_INTEGRATION.md",
  "LOCAL_DEMO_DATA.md",
  "LOCAL_PUBLIC_FOUNDATION_RUNBOOK.md",
  "PUBLIC_FOUNDATION_FINAL_AUDIT.md",
];
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
export function audit(root: string) {
  const base = resolve(root);
  const read = (path: string) => {
    const full = resolve(base, path);
    if (relative(base, full).startsWith("..")) throw new Error("AUDIT_ROOT_ESCAPE");
    return readFileSync(full, "utf8");
  };
  const failures: string[] = [];
  for (const file of requiredFiles)
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
  const ci = read(".github/workflows/ci.yml");
  if (!ci.includes("demo:ci:public-foundation")) failures.push("ci:orchestrator");
  const manual = ["demo:seed", "smoke:home-catalog", "demo:reset"].every((s) =>
    ci.includes(`bun run ${s}`),
  );
  if (manual) failures.push("ci:duplicate");
  const currentDocs = ["README.md", "DEVELOPER_HANDOFF.md"];
  const stale = [
    /não existe backend/i,
    /qualquer (e-mail|email).+senha/i,
    /todos os services são mocks/i,
  ];
  let staleCurrentClaims = 0;
  for (const file of currentDocs)
    for (const pattern of stale) if (pattern.test(read(file))) staleCurrentClaims++;
  if (staleCurrentClaims) failures.push("docs:stale");
  return {
    ok: failures.length === 0,
    requiredFiles: requiredFiles.length,
    realPublicRoutes: 3,
    publicSmokes: 3,
    legacyServiceLeaks: failures.filter((f) => f.includes("legacy")).length,
    staleCurrentClaims,
    failures,
  };
}
if (import.meta.main) {
  const result = audit(import.meta.dir + "/..");
  console.log(JSON.stringify(result));
  if (!result.ok) process.exit(1);
}
