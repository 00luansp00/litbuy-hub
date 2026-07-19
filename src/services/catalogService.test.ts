import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { catalogService } from "./catalogService";

describe("catalogService parser", () => {
  const ok = {
    items: [
      {
        id: "00000000-0000-4000-8000-000000000001",
        slug: "contas",
        name: "Contas",
        description: "d",
        iconKey: "Gift",
        colorHex: "#8B5CF6",
        featured: true,
        sortOrder: 1,
      },
    ],
  };
  it("parses valid categories", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(ok), { status: 200 })),
    );
    await expect(catalogService.getCategories()).resolves.toMatchObject([
      { slug: "contas", icon: "Gift" },
    ]);
  });
  it.each([{ id: "bad" }, { slug: "Bad" }, { colorHex: "red" }, { iconKey: "Hack" }])(
    "rejects malformed category %#",
    async (patch) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(
          async () =>
            new Response(JSON.stringify({ items: [{ ...ok.items[0], ...patch }] }), {
              status: 200,
            }),
        ),
      );
      await expect(catalogService.getCategories()).rejects.toMatchObject({
        code: "CATALOG_RESPONSE_INVALID",
      } as ApiError);
    },
  );
  it("rejects malformed attributes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              items: [{ key: "elo", label: "Elo", inputType: "select", options: [] }],
            }),
            { status: 200 },
          ),
      ),
    );
    await expect(
      catalogService.getAttributesForSubcategory("contas", "valorant", "account"),
    ).rejects.toMatchObject({ code: "CATALOG_RESPONSE_INVALID" });
  });
});
