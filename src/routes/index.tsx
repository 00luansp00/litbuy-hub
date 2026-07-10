import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "@/components/home/Hero";
import { CategoriesGrid } from "@/components/home/CategoriesGrid";
import { ProductSection } from "@/components/home/ProductSection";
import { MarketplaceStats } from "@/components/home/MarketplaceStats";
import { Benefits } from "@/components/home/Benefits";
import { Newsletter } from "@/components/home/Newsletter";
import { categoryService, productService } from "@/services/productService";

export const Route = createFileRoute("/")({
  loader: async () => {
    const [categories, featured, popular, recent] = await Promise.all([
      categoryService.list(),
      productService.featured(),
      productService.popular(),
      productService.recent(),
    ]);
    return { categories, featured, popular, recent };
  },
  component: HomePage,
});

function HomePage() {
  const { categories, featured, popular, recent } = Route.useLoaderData();

  return (
    <>
      <Hero />
      <CategoriesGrid categories={categories} />
      <ProductSection
        eyebrow="Em destaque"
        title="Produtos em destaque"
        description="Selecionados a dedo pela nossa curadoria."
        href="/"
        products={featured}
        count={8}
      />
      <MarketplaceStats />
      <ProductSection
        eyebrow="Mais vendidos"
        title="Populares agora"
        description="O que a comunidade LIT Buy está comprando essa semana."
        href="/"
        products={popular}
        count={8}
      />
      <ProductSection
        eyebrow="Novidades"
        title="Chegou agora"
        description="Os últimos anúncios publicados no marketplace."
        href="/"
        products={recent}
        count={8}
      />
      <Benefits />
      <Newsletter />
    </>
  );
}
