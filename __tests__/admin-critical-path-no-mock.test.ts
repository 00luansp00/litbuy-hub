import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const criticalRoutes = [
  {
    file: "src/routes/admin.vendedores.tsx",
    boundaries: ["sellerOnboardingService"],
  },
  {
    file: "src/routes/admin.anuncios.tsx",
    boundaries: ["listingDraftApiService", "catalogService"],
  },
  {
    file: "src/routes/admin.catalogo.tsx",
    boundaries: ["catalogService.admin"],
  },
];

describe("admin critical path operational authorities", () => {
  it.each(criticalRoutes)("uses only real service boundaries in $file", ({ file, boundaries }) => {
    const source = readFileSync(file, "utf8");

    for (const boundary of boundaries) expect(source).toContain(boundary);
    expect(source).not.toMatch(/from ["']@\/data\/(?:adminData|demoData)["']/);
    expect(source).not.toContain("sellerDashboardService");
    expect(source).not.toContain("localStorage");
  });
});
