import { Skeleton } from "@/components/ui/skeleton";

export function PublicCatalogSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
      aria-label="Carregando anúncios públicos"
    >
      {Array.from({ length: count }, (_, index) => (
        <div className="overflow-hidden rounded-2xl border border-border p-4" key={index}>
          <Skeleton className="aspect-[4/3] w-full rounded-xl" />
          <Skeleton className="mt-4 h-5 w-4/5" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-2/3" />
          <Skeleton className="mt-5 h-7 w-1/2" />
        </div>
      ))}
    </div>
  );
}
