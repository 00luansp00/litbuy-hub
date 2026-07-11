import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { Breadcrumb } from "@/components/common/Breadcrumb";
import { EmptyState } from "@/components/common/EmptyState";
import { ProductGrid } from "@/components/common/ProductGrid";
import { CategoriesGrid } from "@/components/common/CategoriesGrid";
import { SectionHeader } from "@/components/common/SectionHeader";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { PopularSearches } from "@/components/search/PopularSearches";
import { SearchFiltersPanel } from "@/components/search/SearchFiltersPanel";
import { SearchPageHeader } from "@/components/search/SearchPageHeader";
import { SearchSortBar } from "@/components/search/SearchSortBar";
import { categoryService } from "@/services/productService";
import { searchService } from "@/services/searchService";
import type {
  PopularSearch,
  SearchFacets,
  SearchFilters,
  SearchResult,
  SearchSortOption,
  SearchStats,
} from "@/types";

const searchSchema = z.object({
  q: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/buscar")({
  validateSearch: searchSchema,
  component: SearchPage,
});

function SearchPage() {
  const { q } = Route.useSearch();
  const navigate = useNavigate();
  const query = (q ?? "").trim();
  const hasQuery = query.length > 0;

  const [result, setResult] = useState<SearchResult | null>(null);
  const [stats, setStats] = useState<SearchStats | null>(null);
  const [facets, setFacets] = useState<SearchFacets | null>(null);
  const [popular, setPopular] = useState<PopularSearch[]>([]);
  const [categories, setCategories] = useState<
    Awaited<ReturnType<typeof categoryService.list>>
  >([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [sort, setSort] = useState<SearchSortOption>("relevance");

  // Reset filters when the query itself changes.
  useEffect(() => {
    setFilters({});
    setSort("relevance");
  }, [query]);

  useEffect(() => {
    let alive = true;
    Promise.all([
      searchService.getPopularSearches(),
      searchService.getSearchFilters(),
      categoryService.list(),
    ]).then(([p, f, cats]) => {
      if (!alive) return;
      setPopular(p);
      setFacets(f);
      setCategories(cats);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!hasQuery) {
      setResult(null);
      setStats(null);
      return;
    }
    let alive = true;
    setLoading(true);
    searchService
      .searchProducts(query, filters, sort)
      .then((res) => {
        if (!alive) return;
        setResult(res);
        setStats({
          query,
          total: res.total,
          categoriesMatched: new Set(res.products.map((p) => p.categorySlug)).size,
          sellersMatched: new Set(
            res.products.map((p) => p.seller?.id).filter(Boolean) as string[],
          ).size,
        });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [query, filters, sort, hasQuery]);

  const handleReset = () => {
    setFilters({});
    toast.success("Filtros limpos");
  };

  return (
    <div className="container-lit space-y-6 py-6 md:space-y-8 md:py-10">
      <Breadcrumb
        items={[
          { label: "Home", to: "/" },
          { label: "Busca" },
        ]}
      />

      <SearchPageHeader query={query} stats={stats} />

      {!hasQuery ? (
        <div className="space-y-10">
          <PopularSearches items={popular} />

          <section className="space-y-4">
            <SectionHeader
              eyebrow="Categorias"
              title="Explore por categoria"
              description="Escolha uma categoria para começar a descobrir produtos."
            />
            <CategoriesGrid categories={categories} />
          </section>

          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/">Voltar para a Home</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/categoria/$slug" params={{ slug: "contas" }}>
                Explorar Contas
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Filtros mobile */}
          <div className="lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="secondary" className="w-full">
                  <SlidersHorizontal className="mr-2 h-4 w-4" /> Filtros
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[85vw] max-w-sm overflow-y-auto p-4">
                <SheetTitle className="mb-4">Filtros</SheetTitle>
                <SearchFiltersPanel
                  facets={facets}
                  filters={filters}
                  onChange={setFilters}
                  onReset={handleReset}
                />
              </SheetContent>
            </Sheet>
          </div>

          <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
            <div className="hidden lg:block">
              <div className="sticky top-24">
                <SearchFiltersPanel
                  facets={facets}
                  filters={filters}
                  onChange={setFilters}
                  onReset={handleReset}
                />
              </div>
            </div>

            <div className="min-w-0 space-y-5">
              <SearchSortBar
                total={result?.total ?? 0}
                sort={sort}
                onSortChange={setSort}
              />

              {!loading && result && result.total === 0 ? (
                <EmptyState
                  icon="SearchX"
                  title="Nenhum produto encontrado"
                  description={`Não encontramos resultados para "${query}". Tente outro termo ou explore as categorias.`}
                  action={{ label: "Explorar categorias", to: "/" }}
                  className="min-h-[320px]"
                />
              ) : (
                <ProductGrid
                  products={result?.products ?? []}
                  columns={3}
                  loading={loading}
                  skeletonCount={6}
                />
              )}

              {!loading && result && result.total === 0 && (
                <div className="flex justify-center">
                  <Button variant="ghost" onClick={() => navigate({ to: "/buscar", search: {} })}>
                    Nova busca
                  </Button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
