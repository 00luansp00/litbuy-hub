import type { PublicCatalogCard as CatalogCard } from "@/services/publicCatalog";
import { PublicCatalogCard } from "./PublicCatalogCard";

export function PublicCatalogGrid({
  items,
  columns = 4,
}: {
  items: CatalogCard[];
  columns?: 3 | 4;
}) {
  return (
    <div
      className={`grid grid-cols-1 gap-6 sm:grid-cols-2 ${columns === 3 ? "xl:grid-cols-3" : "lg:grid-cols-4"}`}
    >
      {items.map((product) => (
        <PublicCatalogCard key={product.id} product={product} />
      ))}
    </div>
  );
}
