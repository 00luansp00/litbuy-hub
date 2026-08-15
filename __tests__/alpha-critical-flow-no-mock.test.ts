import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type CriticalBoundary = {
  file: string;
  requires: string[];
  forbids?: string[];
};

const legacyAuthorities = [
  "@/data/",
  "@/services/productService",
  "@/services/orderService",
  "sellerSaleService",
  "sellerDashboardService",
  "listingDraftService",
  "localStorage",
  "sessionStorage",
];

const criticalFlow: CriticalBoundary[] = [
  { file: "src/routes/perfil.vendedor.tsx", requires: ["sellerOnboardingService"] },
  { file: "src/routes/admin.vendedores.tsx", requires: ["sellerOnboardingService"] },
  {
    file: "src/components/seller-dashboard/listing-wizard/ListingDraftWizard.tsx",
    requires: ["listingDraftApiService", "catalogService"],
  },
  {
    file: "src/routes/vendedor.anuncios.index.tsx",
    requires: ["listingDraftApiService", "ProductImageManager", "ProductLifecycleManager"],
  },
  {
    file: "src/components/seller-dashboard/product-images/ProductImageManager.tsx",
    requires: ["productImageService"],
  },
  {
    file: "src/components/seller-dashboard/ProductLifecycleManager.tsx",
    requires: ["productLifecycleService"],
  },
  {
    file: "src/routes/admin.anuncios.tsx",
    requires: ["listingDraftApiService", "catalogService"],
  },
  { file: "src/routes/admin.catalogo.tsx", requires: ["catalogService.admin"] },
  {
    file: "src/routes/index.tsx",
    requires: ["@/services/catalogService", "publicCatalogService"],
  },
  {
    file: "src/routes/categoria.$slug.tsx",
    requires: ["@/services/catalogService", "publicCatalogService"],
  },
  { file: "src/routes/produto.$id.tsx", requires: ["publicCatalogService"] },
  {
    file: "src/components/public-product-detail/PublicProductPurchasePanel.tsx",
    requires: ["useAddBuyerCartItem", "useBuyerSellerCart", "@/services/cartApiHooks"],
  },
  { file: "src/routes/carrinho.tsx", requires: ["@/services/cartApiHooks"] },
  {
    file: "src/routes/checkout.tsx",
    requires: ["@/services/cartApiHooks", "@/services/checkoutApiHooks"],
  },
  { file: "src/routes/pedidos.index.tsx", requires: ["@/services/orders"] },
  { file: "src/routes/pedidos.$id.tsx", requires: ["@/services/orders"] },
  {
    file: "src/routes/pagamento.$id.tsx",
    requires: ["@/services/payments", "@/services/orders"],
  },
  { file: "src/routes/vendedor.vendas.index.tsx", requires: ["@/services/orders"] },
  {
    file: "src/routes/vendedor.vendas.$id.tsx",
    requires: ["@/services/orders", "useMarkSellerSaleDelivered"],
  },
  {
    file: "src/routes/vendedor.financeiro.tsx",
    requires: ["@/services/finance/sellerFinance"],
  },
];

describe("Alpha critical flow real-boundary integration", () => {
  it.each(criticalFlow)(
    "keeps $file on its explicit real boundaries",
    ({ file, requires, forbids = [] }) => {
      const source = readFileSync(file, "utf8");

      for (const boundary of requires) expect(source, `${file}: ${boundary}`).toContain(boundary);
      for (const legacy of [...legacyAuthorities, ...forbids])
        expect(source, `${file}: legacy authority ${legacy}`).not.toContain(legacy);
    },
  );

  it("keeps obsolete future-integration claims out of critical publication surfaces", () => {
    const files = [
      "src/components/public-catalog/PublicCatalogSection.tsx",
      "src/routes/categoria.$slug.tsx",
      "src/components/public-product-detail/PublicProductDetailContent.tsx",
      "src/components/seller-dashboard/ProductLifecycleManager.tsx",
      "src/routes/vendedor.anuncios.index.tsx",
    ];
    const source = files.map((file) => readFileSync(file, "utf8")).join("\n");

    expect(source).not.toMatch(/compra ser(?:á|ao) conectad/i);
    expect(source).not.toMatch(/pagamento .*ser(?:á|ao) conectad/i);
    expect(source).not.toMatch(/publicação pública ainda não está disponível/i);
    expect(source).not.toMatch(/ativo ainda não significa exposição/i);
  });
});
