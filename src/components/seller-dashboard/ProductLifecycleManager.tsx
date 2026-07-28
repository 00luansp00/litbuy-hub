import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  productLifecycleService,
  type ProductLifecycleAction,
  type ProductLifecycleState,
} from "@/services/productLifecycleService";

const labels = {
  UNPUBLISHED: "Não ativo",
  ACTIVE: "Ativo",
  PAUSED: "Pausado",
  REMOVED: "Removido",
} as const;

export function ProductLifecycleManager({
  productId,
  onStateChange,
}: {
  productId: string;
  onStateChange?: (product: ProductLifecycleState) => void;
}) {
  const [product, setProduct] = useState<ProductLifecycleState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState<ProductLifecycleAction | null>(null);
  const onStateChangeRef = useRef(onStateChange);
  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);
  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const current = await productLifecycleService.get(productId);
      setProduct(current);
      onStateChangeRef.current?.(current);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [productId]);
  useEffect(() => void load(), [load]);

  const transition = async (action: ProductLifecycleAction) => {
    if (!product || pending) return;
    if (
      action === "REMOVE" &&
      !window.confirm("Remover este produto? A remoção é terminal nesta etapa.")
    )
      return;
    setPending(action);
    try {
      await productLifecycleService.transition(product.id, action, product.version);
      toast.success(action === "REMOVE" ? "Produto removido" : "Status atualizado");
      await load();
    } catch (cause) {
      const error = cause as { code?: string };
      if (error.code === "PRODUCT_VERSION_CONFLICT") {
        toast.error("O produto foi alterado em outra sessão. Recarregamos o estado atual.");
        await load();
      } else toast.error("Não foi possível atualizar o produto.");
    } finally {
      setPending(null);
    }
  };

  if (loading) return <p className="mt-3 text-sm text-muted-foreground">Carregando produto…</p>;
  if (error || !product)
    return (
      <div className="mt-3 text-sm">
        <p>Não foi possível carregar o estado do produto.</p>
        <Button size="sm" variant="outline" onClick={load}>
          Tentar novamente
        </Button>
      </div>
    );
  return (
    <section className="mt-3 rounded-xl border p-3" aria-label="Ciclo de vida do produto">
      <p className="text-sm font-medium">
        Status real: {labels[product.status]} · v{product.version}
      </p>
      {product.status === "UNPUBLISHED" && (
        <p className="mt-1 text-xs text-muted-foreground">
          A ativação é real no backend, mas a exposição no catálogo público será conectada em uma
          próxima etapa.
        </p>
      )}
      {product.status === "ACTIVE" && (
        <p className="mt-1 text-xs text-muted-foreground">
          Ativo ainda não significa exposição no catálogo público.
        </p>
      )}
      {product.status === "REMOVED" && (
        <p className="mt-1 text-xs text-muted-foreground">A remoção é terminal nesta etapa.</p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {product.status === "UNPUBLISHED" && (
          <Button size="sm" disabled={!!pending} onClick={() => transition("ACTIVATE")}>
            Ativar produto
          </Button>
        )}
        {product.status === "ACTIVE" && (
          <Button
            size="sm"
            variant="outline"
            disabled={!!pending}
            onClick={() => transition("PAUSE")}
          >
            Pausar
          </Button>
        )}
        {product.status === "PAUSED" && (
          <Button size="sm" disabled={!!pending} onClick={() => transition("RESUME")}>
            Retomar
          </Button>
        )}
        {(product.status === "ACTIVE" || product.status === "PAUSED") && (
          <Button
            size="sm"
            variant="destructive"
            disabled={!!pending}
            onClick={() => transition("REMOVE")}
          >
            Remover
          </Button>
        )}
      </div>
    </section>
  );
}
