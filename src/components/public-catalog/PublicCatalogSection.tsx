import { AlertCircle, PackageOpen, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/common/SectionHeader";
import type { PublicCatalogListResponse } from "@/services/publicCatalog";
import { PublicCatalogGrid } from "./PublicCatalogGrid";
import { PublicCatalogSkeleton } from "./PublicCatalogSkeleton";

type Props = {
  catalog?: PublicCatalogListResponse;
  error?: boolean;
  loading?: boolean;
  onRetry?: () => void;
};

export function PublicCatalogSection({ catalog, error = false, loading = false, onRetry }: Props) {
  return (
    <section className="container-lit py-12 md:py-16" data-testid="public-catalog-section">
      <SectionHeader
        eyebrow="Catálogo real"
        title="Anúncios recentes"
        description="Produtos públicos carregados diretamente da API da LIT Buy."
      />
      {loading ? (
        <PublicCatalogSkeleton />
      ) : error ? (
        <div
          className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-border bg-muted/30 p-8 text-center"
          role="alert"
        >
          <AlertCircle className="mb-3 h-9 w-9 text-muted-foreground" aria-hidden="true" />
          <p className="font-semibold">Não foi possível carregar os anúncios agora.</p>
          <p className="mt-1 text-sm text-muted-foreground">Tente novamente em instantes.</p>
          {onRetry && (
            <Button className="mt-5" variant="outline" onClick={onRetry}>
              <RefreshCw className="h-4 w-4" /> Tentar novamente
            </Button>
          )}
        </div>
      ) : catalog?.items.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border p-8 text-center">
          <PackageOpen className="mb-3 h-9 w-9 text-muted-foreground" aria-hidden="true" />
          <p className="font-semibold">Nenhum anúncio público disponível no momento.</p>
        </div>
      ) : catalog ? (
        <PublicCatalogGrid items={catalog.items} />
      ) : null}
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Estes anúncios vêm da API real. Detalhes e compra serão conectados nas próximas etapas.
      </p>
    </section>
  );
}
