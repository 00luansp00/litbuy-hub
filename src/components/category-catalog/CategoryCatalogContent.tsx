import { Button } from "@/components/ui/button";
import { PublicCatalogGrid } from "@/components/public-catalog";
import type {
  PublicCatalogListResponse,
  PublicCatalogProductType,
  PublicCatalogSort,
} from "@/services/publicCatalog";
import type { Subcategory } from "@/types";
import { CategoryCatalogControls } from "./CategoryCatalogControls";
import { CategoryCatalogPagination } from "./CategoryCatalogPagination";

type FilterChange = {
  subcategory?: string;
  productType?: PublicCatalogProductType;
  sort?: PublicCatalogSort;
};
type Props = {
  catalog: PublicCatalogListResponse;
  subcategories: Subcategory[];
  subcategory?: string;
  productType?: PublicCatalogProductType;
  sort: PublicCatalogSort;
  onFilterChange: (change: FilterChange) => void;
  onClearFilters: () => void;
  onPageChange: (page: number) => void;
};

export function CategoryCatalogContent(props: Props) {
  const { catalog, subcategory, productType, sort } = props;
  const filtered = Boolean(subcategory || productType || sort !== "RECENT");
  const laterPage = catalog.pagination.page > 1;
  const emptyMessage = laterPage
    ? filtered
      ? "Nenhum anúncio encontrado nesta página para estes filtros."
      : "Nenhum anúncio disponível nesta página."
    : filtered
      ? "Nenhum anúncio encontrado para estes filtros."
      : "Ainda não existem anúncios públicos nesta categoria.";

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
      <CategoryCatalogControls
        subcategories={props.subcategories}
        subcategory={subcategory}
        productType={productType}
        sort={sort}
        onChange={props.onFilterChange}
      />
      <div className="min-w-0 space-y-5">
        <p className="text-sm text-muted-foreground">
          Exibindo {catalog.items.length} {catalog.items.length === 1 ? "anúncio" : "anúncios"}{" "}
          nesta página
        </p>
        {catalog.items.length ? (
          <PublicCatalogGrid items={catalog.items} columns={3} />
        ) : (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <p className="font-semibold">{emptyMessage}</p>
            {filtered && (
              <Button className="mt-4" variant="outline" onClick={props.onClearFilters}>
                Limpar filtros
              </Button>
            )}
          </div>
        )}
        <CategoryCatalogPagination
          page={catalog.pagination.page}
          hasNext={catalog.pagination.hasNext}
          onPage={props.onPageChange}
        />
      </div>
    </div>
  );
}
