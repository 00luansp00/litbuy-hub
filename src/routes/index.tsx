import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Hero } from "@/components/home/Hero";
import { CategoriesGrid } from "@/components/home/CategoriesGrid";
import { PublicCatalogSection } from "@/components/public-catalog";
import { MarketplaceStats } from "@/components/home/MarketplaceStats";
import { Benefits } from "@/components/home/Benefits";
import { Newsletter } from "@/components/home/Newsletter";
import { categoryService } from "@/services/catalogService";
import { publicCatalogService } from "@/services/publicCatalog";

async function loadHomeData() {
  const [categories, catalog] = await Promise.all([
    categoryService.list(),
    publicCatalogService
      .list({ sort: "RECENT", page: 1, limit: 8 })
      .then((data) => ({ status: "success" as const, data }))
      .catch(() => ({ status: "error" as const })),
  ]);
  return { categories, catalog };
}

export const Route = createFileRoute("/")({
  loader: loadHomeData,
  pendingComponent: HomePending,
  component: HomePage,
});

function HomePage() {
  const { categories, catalog } = Route.useLoaderData();
  const router = useRouter();

  return (
    <>
      <Hero />
      <CategoriesGrid categories={categories} />
      <PublicCatalogSection
        catalog={catalog.status === "success" ? catalog.data : undefined}
        error={catalog.status === "error"}
        onRetry={() => void router.invalidate()}
      />
      <MarketplaceStats />
      <Benefits />
      <Newsletter />
    </>
  );
}

export function HomePending() {
  return (
    <>
      <Hero />
      <PublicCatalogSection loading />
      <MarketplaceStats />
      <Benefits />
      <Newsletter />
    </>
  );
}
