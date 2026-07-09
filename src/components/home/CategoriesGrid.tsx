import { CategoriesGrid as CategoriesGridLayout } from "@/components/common/CategoriesGrid";
import { SectionHeader } from "@/components/common/SectionHeader";
import type { Category } from "@/types";

interface CategoriesSectionProps {
  categories: Category[];
}

/**
 * Seção "Categorias em destaque" da Home.
 * Apenas orquestra SectionHeader + CategoriesGrid reutilizável.
 */
export function CategoriesGrid({ categories }: CategoriesSectionProps) {
  return (
    <section className="container-lit py-12 md:py-16">
      <SectionHeader
        eyebrow="Navegue"
        title="Categorias em destaque"
        description="Encontre exatamente o que você procura em nossas categorias mais populares."
        href="/"
        actionLabel="Ver todas"
      />
      <CategoriesGridLayout categories={categories} />
    </section>
  );
}
