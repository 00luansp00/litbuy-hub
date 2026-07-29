import { Skeleton } from "@/components/ui/skeleton";
import { PublicCatalogSkeleton } from "@/components/public-catalog";
export function CategoryCatalogSkeleton() {
  return (
    <div className="container-lit space-y-6 py-10" aria-label="Carregando catálogo da categoria">
      <Skeleton className="h-48 w-full rounded-2xl" />
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Skeleton className="h-72" />
        <PublicCatalogSkeleton count={12} />
      </div>
    </div>
  );
}
