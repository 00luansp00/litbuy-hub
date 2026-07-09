import { Skeleton } from "@/components/ui/skeleton";

/**
 * ProductSkeleton — placeholder de carregamento com o mesmo shape do ProductCard.
 */
export function ProductSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-10" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="mt-auto flex items-end justify-between">
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-5 w-20" />
          </div>
          <Skeleton className="h-9 w-9 rounded-md" />
        </div>
      </div>
    </div>
  );
}
