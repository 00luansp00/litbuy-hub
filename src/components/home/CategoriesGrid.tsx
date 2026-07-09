import { CategoryCard } from "@/components/common/CategoryCard";
import { SectionHeader } from "@/components/common/SectionHeader";
import type { Category } from "@/types";

interface CategoriesGridProps {
  categories: Category[];
}

export function CategoriesGrid({ categories }: CategoriesGridProps) {
  return (
    <section className="container-lit py-12 md:py-16">
      <SectionHeader
        eyebrow="Navegue"
        title="Categorias em destaque"
        description="Encontre exatamente o que você procura em nossas categorias mais populares."
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {categories.map((c) => (
          <CategoryCard key={c.id} category={c} />
        ))}
      </div>
    </section>
  );
}

