import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { audit, currentDocs, requiredFiles } from "../scripts/public-foundation-audit";
const roots: string[] = [];
const write = (root: string, path: string, text: string) => {
  mkdirSync(join(root, path, ".."), { recursive: true });
  writeFileSync(join(root, path), text);
};
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "foundation-audit-"));
  roots.push(root);
  const docs =
    "Backend NestJS, PostgreSQL e autenticação reais. Home, categoria e detalhe usam publicCatalogService; busca, loja e comércio permanecem demonstrativos. MinIO/S3 privado armazena imagens de produto.";
  for (const file of new Set([...requiredFiles, ...currentDocs])) write(root, file, docs);
  write(root, "MVP_STATUS.md", "Snapshot histórico; consulte PUBLIC_FOUNDATION_FINAL_AUDIT.md");
  write(
    root,
    "PRE_HANDOFF_AUDIT.md",
    "Snapshot histórico; consulte PUBLIC_FOUNDATION_FINAL_AUDIT.md",
  );
  write(root, "src/routes/index.tsx", "publicCatalogService");
  write(root, "src/routes/categoria.$slug.tsx", "publicCatalogService");
  write(root, "src/routes/produto.$id.tsx", "publicCatalogService");
  write(
    root,
    "src/components/public-catalog/PublicCatalogCard.tsx",
    '<Link to="/produto/$id" params={{id: product.slug}} />',
  );
  const scripts = Object.fromEntries(
    [
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
    ].map((x) => [x, x]),
  );
  scripts["demo:down"] = "docker compose down";
  write(root, "package.json", JSON.stringify({ scripts }));
  write(
    root,
    "scripts/public-foundation-rehearsal.ts",
    "fetch(url); INFRA_SMOKE_BASE_URL; INFRA_SMOKE_ORIGIN",
  );
  write(
    root,
    ".github/workflows/ci.yml",
    "bun run demo:prepare\nbun run demo:check\nCI=true bun run demo:ci:public-foundation",
  );
  return root;
}
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));
describe("public foundation audit", () => {
  it("accepts a truthful fixture and returns safe output", () => {
    const result = audit(fixture());
    expect(result.ok).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/password|cookie|token/i);
  });
  it("detects a required file missing", () => {
    const root = fixture();
    rmSync(join(root, requiredFiles[0]));
    expect(audit(root).ok).toBe(false);
  });
  it.each([
    ["SERVICES_MAP.md", "publicCatalogService é consumido somente pela Home"],
    ["SERVICES_MAP.md", "productService é consumido pela rota /produto/$id, que está mockada"],
    ["MOCKS_INVENTORY.md", "Todos os services são mocks"],
    ["BACKEND_ROADMAP.md", "A rota /categoria/$slug é futura e a rota /produto/$id é futura"],
    ["HANDOFF_CHECKLIST.md", "Definir stack de backend com o dev (Supabase assumido)"],
  ])("detects stale claim in %s", (file, text) => {
    const root = fixture();
    write(root, file, text);
    expect(audit(root).staleCurrentClaims).toBeGreaterThan(0);
  });
  it("accepts marked history and rejects unmarked history", () => {
    const root = fixture();
    expect(audit(root).ok).toBe(true);
    write(root, "PRE_HANDOFF_AUDIT.md", "Nenhum backend naquele sprint");
    expect(audit(root).failures).toContain("historical-unmarked:PRE_HANDOFF_AUDIT.md");
  });
  it.each([
    [
      "missing infra base",
      (r: string) =>
        write(r, "scripts/public-foundation-rehearsal.ts", "fetch(url); INFRA_SMOKE_ORIGIN"),
    ],
    [
      "missing infra origin",
      (r: string) =>
        write(r, "scripts/public-foundation-rehearsal.ts", "fetch(url); INFRA_SMOKE_BASE_URL"),
    ],
    [
      "curl",
      (r: string) =>
        write(
          r,
          "scripts/public-foundation-rehearsal.ts",
          '["curl"]; INFRA_SMOKE_BASE_URL; INFRA_SMOKE_ORIGIN',
        ),
    ],
    [
      "down volumes",
      (r: string) => {
        const p = JSON.parse(requireText(r, "package.json"));
        p.scripts["demo:down"] = "docker compose down -v";
        write(r, "package.json", JSON.stringify(p));
      },
    ],
    [
      "workflow prepare",
      (r: string) =>
        write(
          r,
          ".github/workflows/ci.yml",
          "bun run demo:check\nbun run demo:ci:public-foundation",
        ),
    ],
    [
      "workflow check",
      (r: string) =>
        write(
          r,
          ".github/workflows/ci.yml",
          "bun run demo:prepare\nbun run demo:ci:public-foundation",
        ),
    ],
    [
      "manual duplicate",
      (r: string) =>
        write(
          r,
          ".github/workflows/ci.yml",
          "bun run demo:prepare\nbun run demo:check\nbun run demo:ci:public-foundation\nbun run demo:seed\nbun run smoke:home-catalog\nbun run demo:reset",
        ),
    ],
  ])("detects %s regression", (_name, mutate) => {
    const root = fixture();
    mutate(root);
    expect(audit(root).ok).toBe(false);
  });
  it("detects route/card legacy leaks", () => {
    const root = fixture();
    write(root, "src/routes/categoria.$slug.tsx", 'import "services/productService"');
    write(root, "src/routes/produto.$id.tsx", "reviewService");
    write(root, "src/components/public-catalog/PublicCatalogCard.tsx", '<a href="/produto/x">');
    expect(audit(root).ok).toBe(false);
  });
});
function requireText(root: string, path: string) {
  return readFileSync(join(root, path), "utf8");
}
