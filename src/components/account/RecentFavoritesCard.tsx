import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { ProductGrid } from "@/components/common/ProductGrid";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";

interface RecentFavoritesCardProps {
  products: Product[];
  loading?: boolean;
  className?: string;
  hideHeader?: boolean;
}

export function RecentFavoritesCard({
  products,
  loading = false,
  className,
  hideHeader,
}: RecentFavoritesCardProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card p-5 shadow-card md:p-6",
        className,
      )}
      aria-label="Favoritos recentes"
    >
      {!hideHeader && (
        <header className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Favoritos recentes
            </h3>
            <p className="text-xs text-muted-foreground">
              Itens que você salvou para depois.
            </p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/favoritos">
              Ver todos <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </header>
      )}

      {!loading && products.length === 0 ? (
        <EmptyState
          icon="Heart"
          title="Nada favoritado ainda"
          description="Clique no coração de qualquer anúncio para salvá-lo aqui."
          action={{ label: "Descobrir produtos", to: "/" }}
        />
      ) : (
        <ProductGrid
          products={products}
          columns={4}
          loading={loading}
          skeletonCount={4}
        />
      )}
    </section>
  );
}
