import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "@/components/home/Hero";
import { CategoriesGrid } from "@/components/home/CategoriesGrid";
import { ProductsSection } from "@/components/home/ProductsSection";
import { Benefits } from "@/components/home/Benefits";
import { Newsletter } from "@/components/home/Newsletter";
import { categories } from "@/data/categories";
import { products } from "@/data/products";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const featured = products.filter((p) => p.badge === "hot" || p.badge === "top");
  const popular = [...products].sort((a, b) => b.soldCount - a.soldCount).slice(0, 8);
  const recent = [...products].slice(-8).reverse();

  return (
    <>
      <Hero />
      <CategoriesGrid categories={categories} />
      <ProductsSection
        eyebrow="Em destaque"
        title="Produtos em destaque"
        description="Selecionados a dedo pela nossa curadoria."
        href="/"
        products={featured}
      />
      <ProductsSection
        eyebrow="Mais vendidos"
        title="Populares agora"
        description="O que a comunidade LIT Buy está comprando essa semana."
        href="/"
        products={popular}
      />
      <ProductsSection
        eyebrow="Novidades"
        title="Chegou agora"
        description="Os últimos anúncios publicados no marketplace."
        href="/"
        products={recent}
      />
      <Benefits />
      <Newsletter />
    </>
  );
}
