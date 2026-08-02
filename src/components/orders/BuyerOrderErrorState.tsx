import { Button } from "@/components/ui/button";
export function BuyerOrderErrorState({
  message = "Não foi possível carregar os pedidos.",
  retry,
}: {
  message?: string;
  retry: () => void;
}) {
  return (
    <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
      <h3 className="font-semibold">Algo deu errado</h3>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      <Button className="mt-4" variant="outline" onClick={retry}>
        Tentar novamente
      </Button>
    </div>
  );
}
