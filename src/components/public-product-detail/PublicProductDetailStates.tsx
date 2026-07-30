import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";

export function PublicProductDetailSkeleton() {
  return (
    <div className="container-lit space-y-6 py-8" aria-label="Carregando produto">
      <div className="h-5 w-72 animate-pulse rounded bg-muted" />
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="aspect-square animate-pulse rounded-2xl bg-muted" />
        <div className="space-y-5">
          <div className="h-10 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-9 w-40 animate-pulse rounded bg-muted" />
          <div className="h-48 animate-pulse rounded-2xl bg-muted" />
        </div>
      </div>
      <div className="h-48 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}
export function PublicProductDetailError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="container-lit py-16 text-center">
      <h1 className="text-2xl font-bold">Não foi possível carregar o produto</h1>
      <p className="mt-2 text-muted-foreground">Tente novamente em alguns instantes.</p>
      <Button className="mt-6" onClick={onRetry}>
        Tentar novamente
      </Button>
    </div>
  );
}
export function PublicProductDetailNotFound() {
  return (
    <div className="container-lit py-16">
      <EmptyState
        icon="SearchX"
        title="Produto não encontrado"
        description="O anúncio não existe ou não está disponível publicamente."
        action={{ label: "Voltar para o início", to: "/" }}
      />
    </div>
  );
}
