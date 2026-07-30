import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { audit, requiredFiles } from "../scripts/public-foundation-audit";
const roots: string[] = [];
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "foundation-audit-"));
  roots.push(root);
  for (const path of ["src/routes", "src/components/public-catalog", ".github/workflows"])
    mkdirSync(join(root, path), { recursive: true });
  for (const file of requiredFiles)
    writeFileSync(join(root, file), "estado atual sem alegações obsoletas");
  writeFileSync(join(root, "README.md"), "híbrido");
  writeFileSync(join(root, "DEVELOPER_HANDOFF.md"), "backend real");
  writeFileSync(join(root, "src/routes/index.tsx"), "publicCatalogService");
  writeFileSync(join(root, "src/routes/categoria.$slug.tsx"), "publicCatalogService");
  writeFileSync(join(root, "src/routes/produto.$id.tsx"), "publicCatalogService");
  writeFileSync(
    join(root, "src/components/public-catalog/PublicCatalogCard.tsx"),
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
  writeFileSync(join(root, "package.json"), JSON.stringify({ scripts }));
  writeFileSync(
    join(root, ".github/workflows/ci.yml"),
    "CI=true bun run demo:ci:public-foundation",
  );
  return root;
}
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
describe("public foundation audit", () => {
  it("accepts a valid fixture and returns safe output", () => {
    const result = audit(fixture());
    expect(result.ok).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/password|cookie|token/i);
  });
  it("detects missing file", () => {
    const root = fixture();
    rmSync(join(root, requiredFiles[0]));
    expect(audit(root).ok).toBe(false);
  });
  it.each([
    ["src/routes/categoria.$slug.tsx", "services/productService"],
    ["src/routes/produto.$id.tsx", "reviewService"],
  ])("detects legacy import in %s", (file, text) => {
    const root = fixture();
    writeFileSync(join(root, file), text);
    expect(audit(root).ok).toBe(false);
  });
  it("detects manual card link", () => {
    const root = fixture();
    writeFileSync(
      join(root, "src/components/public-catalog/PublicCatalogCard.tsx"),
      '<a href="/produto/x">x</a>',
    );
    expect(audit(root).ok).toBe(false);
  });
  it("detects missing script", () => {
    const root = fixture();
    writeFileSync(join(root, "package.json"), '{"scripts":{}}');
    expect(audit(root).ok).toBe(false);
  });
  it("detects duplicated workflow", () => {
    const root = fixture();
    writeFileSync(
      join(root, ".github/workflows/ci.yml"),
      "demo:ci:public-foundation\nbun run demo:seed\nbun run smoke:home-catalog\nbun run demo:reset",
    );
    expect(audit(root).ok).toBe(false);
  });
  it("detects stale current documentation", () => {
    const root = fixture();
    writeFileSync(join(root, "README.md"), "não existe backend");
    expect(audit(root).staleCurrentClaims).toBe(1);
  });
  it("does not read outside root", () => {
    const root = fixture();
    expect(() => audit(join(root, "missing"))).toThrow();
  });
});
