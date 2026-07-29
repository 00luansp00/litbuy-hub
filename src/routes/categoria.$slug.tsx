/* eslint-disable react-refresh/only-export-components */
import {
  createFileRoute,
  notFound,
  redirect,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { Breadcrumb } from "@/components/common/Breadcrumb";
import { CategoryHero } from "@/components/common/CategoryHero";
import { EmptyState } from "@/components/common/EmptyState";
import {
  CategoryCatalogContent,
  CategoryCatalogError,
  CategoryCatalogSkeleton,
  productTypeOptions,
  sortOptions,
} from "@/components/category-catalog";
import { ApiError } from "@/lib/api/client";
import { categoryService } from "@/services/catalogService";
import {
  publicCatalogService,
  type PublicCatalogProductType,
  type PublicCatalogSort,
} from "@/services/publicCatalog";

const LIMIT = 12;
const slugPattern = /^(?!.*--)[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;
const sorts = new Set(sortOptions.map(([value]) => value));
const productTypes = new Set(productTypeOptions.map(([value]) => value));
type CategorySearch = {
  subcategory?: string;
  productType?: PublicCatalogProductType;
  sort: PublicCatalogSort;
  page: number;
};

export function normalizeCategorySearch(search: Record<string, unknown>): CategorySearch {
  const subcategory =
    typeof search.subcategory === "string" && slugPattern.test(search.subcategory)
      ? search.subcategory
      : undefined;
  const productType =
    typeof search.productType === "string" &&
    productTypes.has(search.productType as PublicCatalogProductType)
      ? (search.productType as PublicCatalogProductType)
      : undefined;
  const sort =
    typeof search.sort === "string" && sorts.has(search.sort as PublicCatalogSort)
      ? (search.sort as PublicCatalogSort)
      : "RECENT";
  const candidate = typeof search.page === "number" ? search.page : Number(search.page);
  const page =
    Number.isSafeInteger(candidate) && candidate >= 1 && candidate <= 100 ? candidate : 1;
  return { subcategory, productType, sort, page };
}
export function nextCategorySearch(
  current: CategorySearch,
  change: Partial<CategorySearch>,
  resetPage = true,
): CategorySearch {
  return { ...current, ...change, page: resetPage ? 1 : (change.page ?? current.page) };
}
export const clearCategorySearch = (): CategorySearch => ({ sort: "RECENT", page: 1 });
export const retryCategoryCatalog = (invalidate: () => unknown): void => {
  void invalidate();
};

export const Route = createFileRoute("/categoria/$slug")({
  validateSearch: normalizeCategorySearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ params, deps: search }) => {
    const category = await categoryService.bySlug(params.slug).catch((error) => {
      if (error instanceof ApiError && error.code === "CATALOG_CATEGORY_NOT_FOUND")
        throw notFound();
      throw error;
    });
    try {
      const subcategories = await categoryService.getSubcategoriesByCategory(params.slug);
      if (search.subcategory && !subcategories.some((item) => item.slug === search.subcategory)) {
        throw redirect({
          to: "/categoria/$slug",
          params,
          search: { sort: search.sort, productType: search.productType, page: 1 },
        });
      }
      const catalog = await publicCatalogService.list({
        categorySlug: params.slug,
        subcategorySlug: search.subcategory,
        productType: search.productType,
        sort: search.sort,
        page: search.page,
        limit: LIMIT,
      });
      return { category, subcategories, catalog, catalogError: false };
    } catch (error) {
      if (error && typeof error === "object" && "isRedirect" in error) throw error;
      return { category, subcategories: [], catalog: null, catalogError: true };
    }
  },
  component: CategoryPage,
  pendingComponent: CategoryCatalogSkeleton,
  notFoundComponent: CategoryNotFound,
});

function CategoryPage() {
  const { category, subcategories, catalog, catalogError } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const router = useRouter();
  const update = (change: Partial<CategorySearch>, resetPage = true) =>
    navigate({
      search: (previous) => nextCategorySearch(previous, change, resetPage),
    });
  const changePage = (page: number) => {
    void update({ page }, false);
    document.getElementById("category-catalog")?.scrollIntoView({ behavior: "smooth" });
  };
  return (
    <div className="container-lit space-y-6 py-6 md:space-y-8 md:py-10">
      <Breadcrumb
        items={[{ label: "Home", to: "/" }, { label: "Categorias" }, { label: category.name }]}
      />
      <CategoryHero category={category} />
      <div className="rounded-lg border bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
        <p>Os anúncios desta página são carregados diretamente do catálogo público da LIT Buy.</p>
        <p>Detalhes e compra serão conectados em etapas posteriores.</p>
      </div>
      <section id="category-catalog" className="scroll-mt-24">
        {catalogError ? (
          <CategoryCatalogError onRetry={() => retryCategoryCatalog(() => router.invalidate())} />
        ) : (
          catalog && (
            <CategoryCatalogContent
              catalog={catalog}
              subcategories={subcategories}
              subcategory={search.subcategory}
              productType={search.productType}
              sort={search.sort}
              onFilterChange={(change) => void update(change)}
              onClearFilters={() => void navigate({ search: clearCategorySearch() })}
              onPageChange={changePage}
            />
          )
        )}
      </section>
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
