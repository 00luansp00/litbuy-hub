import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "@/components/home/Hero";
import { CategoriesGrid } from "@/components/home/CategoriesGrid";
import { ProductSection } from "@/components/home/ProductSection";
import { MarketplaceStats } from "@/components/home/MarketplaceStats";
import { Benefits } from "@/components/home/Benefits";
import { Newsletter } from "@/components/home/Newsletter";
import { categories } from "@/data/categories";
import { products } from "@/data/products";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const featured = products.filter((p) => p.badge === "hot" || p.badge === "top");
  const popular = [...products].sort((a, b) => b.soldCount - a.soldCount);
  const recent = [...products].reverse();

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
