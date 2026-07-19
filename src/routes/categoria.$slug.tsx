import { createFileRoute, notFound } from "@tanstack/react-router";
import { SlidersHorizontal } from "lucide-react";
import { Breadcrumb } from "@/components/common/Breadcrumb";
import { CategoryHero } from "@/components/common/CategoryHero";
import { EmptyState } from "@/components/common/EmptyState";
import { FilterSidebar } from "@/components/common/FilterSidebar";
import { ProductGrid } from "@/components/common/ProductGrid";
import { SortBar } from "@/components/common/SortBar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { productService } from "@/services/productService";
import { ApiError } from "@/lib/api/client";
import { categoryService } from "@/services/catalogService";

export const Route = createFileRoute("/categoria/$slug")({
  loader: async ({ params }) => {
    const category = await categoryService.bySlug(params.slug).catch((error) => {
      if (error instanceof ApiError && error.code === "CATALOG_CATEGORY_NOT_FOUND") {
        throw notFound();
      }
      throw error;
    });
    const items = await productService.byCategory(params.slug);
    return { category, items };
  },
  component: CategoryPage,
  pendingComponent: () => (
    <div className="container-lit py-16 text-muted-foreground">Carregando categoria real...</div>
  ),
  notFoundComponent: CategoryNotFound,
});

function CategoryPage() {
  const { category, items } = Route.useLoaderData();

  return (
    <div className="container-lit space-y-6 py-6 md:space-y-8 md:py-10">
      <Breadcrumb
        items={[{ label: "Home", to: "/" }, { label: "Categorias" }, { label: category.name }]}
      />

      <CategoryHero category={category} />
      <p className="rounded-lg border border-border bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
        A estrutura desta categoria é real. Os anúncios exibidos ainda são demonstrativos.
      </p>

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
          {items.length === 0 ? (
            <EmptyState
              icon="PackageOpen"
              title="Nenhum anúncio encontrado"
              description="Ainda não temos anúncios nessa categoria. Que tal explorar outras opções?"
              action={{ label: "Voltar para categorias", to: "/" }}
            />
          ) : (
            <ProductGrid products={items} columns={3} loading={false} skeletonCount={6} />
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
