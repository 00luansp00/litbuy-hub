import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import {
  CatalogResponseValidationError,
  parsePublicCategoryListResponse,
  parsePublicCategoryResponse,
  parsePublicSubcategoryListResponse,
  parsePublicSubcategoryResponse,
} from "./publicTaxonomyParser";

const category = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "demo-jogos",
  name: "Jogos — Demonstração",
  iconKey: "Gamepad2",
};
const subcategory = {
  id: "00000000-0000-4000-8000-000000000002",
  slug: "demo-contas",
  name: "Contas",
  categorySlug: "demo-jogos",
};

describe("pure public taxonomy parser", () => {
  it("accepts category values and lists", () => {
    expect(parsePublicCategoryResponse(category)).toMatchObject({ slug: "demo-jogos" });
    expect(parsePublicCategoryListResponse({ items: [category] })).toHaveLength(1);
  });
  it("rejects malformed category contracts with its pure error", () => {
    expect(() => parsePublicCategoryResponse({ ...category, slug: "Bad" })).toThrow(
      CatalogResponseValidationError,
    );
  });
  it("accepts subcategory values and lists", () => {
    expect(parsePublicSubcategoryResponse(subcategory)).toMatchObject({ slug: "demo-contas" });
    expect(parsePublicSubcategoryListResponse({ items: [subcategory] })).toHaveLength(1);
  });
  it.each([{ invalid: true }, { items: [{ ...subcategory, id: "invalid" }] }])(
    "rejects malformed subcategory root or item %#",
    (raw) => {
      expect(() => parsePublicSubcategoryListResponse(raw)).toThrow(CatalogResponseValidationError);
    },
  );
  it("imports and parses in a separate production Bun process without Vite API configuration", () => {
    const { VITE_API_BASE_URL: _omitted, ...environment } = process.env;
    const code = `
      import { parsePublicCategoryResponse, parsePublicSubcategoryListResponse } from "./src/services/catalog/publicTaxonomyParser.ts";
      parsePublicCategoryResponse(${JSON.stringify(category)});
      parsePublicSubcategoryListResponse({ items: [${JSON.stringify(subcategory)}] });
    `;
    const child = spawnSync("bun", ["-e", code], {
      cwd: process.cwd(),
      env: { ...environment, NODE_ENV: "production" },
      encoding: "utf8",
    });
    expect(child.error).toBeUndefined();
    expect(child.stderr).toBe("");
    expect(child.status).toBe(0);
  });
});
