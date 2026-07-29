import { Button } from "@/components/ui/button";
export function CategoryCatalogError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-xl border p-8 text-center">
      <p className="font-semibold">Não foi possível carregar o catálogo agora.</p>
      <p className="mt-1 text-sm text-muted-foreground">Tente novamente em instantes.</p>
      <Button className="mt-4" variant="outline" onClick={onRetry}>
        Tentar novamente
      </Button>
    </div>
  );
}
