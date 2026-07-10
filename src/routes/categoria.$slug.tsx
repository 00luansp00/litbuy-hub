import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Breadcrumb } from "@/components/common/Breadcrumb";
import { CategoryHero } from "@/components/common/CategoryHero";
import { EmptyState } from "@/components/common/EmptyState";
import { FilterSidebar } from "@/components/common/FilterSidebar";
import { ProductGrid } from "@/components/common/ProductGrid";
import { SortBar } from "@/components/common/SortBar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { categoryService, productService } from "@/services/productService";

export const Route = createFileRoute("/categoria/$slug")({
  loader: async ({ params }) => {
    const category = await categoryService.bySlug(params.slug);
    if (!category) throw notFound();
    const items = await productService.byCategory(params.slug);
    return { category, items };
  },
  component: CategoryPage,
  notFoundComponent: CategoryNotFound,
});

function CategoryPage() {
  const { category, items } = Route.useLoaderData();

  // Mock de loading apenas para demonstração visual.
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 450);
    return () => clearTimeout(t);
  }, [category.slug]);

  return (
    <div className="container-lit space-y-6 py-6 md:space-y-8 md:py-10">
      <Breadcrumb
        items={[
          { label: "Home", to: "/" },
          { label: "Categorias" },
          { label: category.name },
        ]}
      />

      <CategoryHero category={category} />

      {/* Botão de filtros para mobile */}
      <div className="lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="secondary" className="w-full">
              <SlidersHorizontal className="mr-2 h-4 w-4" /> Filtros
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[85vw] max-w-sm overflow-y-auto p-4">
            <SheetTitle className="mb-4">Filtros</SheetTitle>
            <FilterSidebar showHeader={false} />
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
        {/* Sidebar desktop */}
        <div className="hidden lg:block">
          <div className="sticky top-24">
            <FilterSidebar />
          </div>
        </div>

        {/* Listagem */}
        <div className="min-w-0 space-y-5">
          <SortBar total={items.length} />
          {items.length === 0 && !loading ? (
            <EmptyState
              icon="PackageOpen"
              title="Nenhum anúncio encontrado"
              description="Ainda não temos anúncios nessa categoria. Que tal explorar outras opções?"
              action={{ label: "Voltar para categorias", to: "/" }}
            />
          ) : (
            <ProductGrid
              products={items}
              columns={3}
              loading={loading}
              skeletonCount={6}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryNotFound() {
  return (
    <div className="container-lit py-16">
      <EmptyState
        icon="SearchX"
        title="Categoria não encontrada"
        description="A categoria que você procura não existe ou foi removida."
        action={{ label: "Voltar para o início", to: "/" }}
      />
    </div>
  );
}
