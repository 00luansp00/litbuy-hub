import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { BuyerCartSellerSection } from "@/components/cart/BuyerCartSellerSection";
import { CartSecurityNotice } from "@/components/cart/CartSecurityNotice";
import { EmptyCartState } from "@/components/cart/EmptyCartState";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/AuthContext";
import { useBuyerCarts } from "@/services/cartApiHooks";

export const Route = createFileRoute("/carrinho")({
  component: CarrinhoPage,
});

export function CarrinhoPage() {
  const { status } = useAuth();
  const [page, setPage] = useState(1);
  const cartsQuery = useBuyerCarts(page, 20);
  const carts = cartsQuery.data?.items ?? [];
  const hasPotentialNextPage = cartsQuery.data ? carts.length === cartsQuery.data.limit : false;

  return (
    <div className="container-lit space-y-8 py-6 md:py-10">
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Meu carrinho
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Seus itens são organizados por seller. Nada é cobrado agora.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" /> Continuar comprando
          </Link>
        </Button>
      </header>

      {status === "initializing" ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Verificando sua sessão…
        </p>
      ) : status === "anonymous" ? (
        <div className="space-y-4 rounded-2xl border bg-card p-6 text-center">
          <p className="text-muted-foreground">
            Entre na sua conta para acessar os carrinhos reais.
          </p>
          <Button asChild>
            <Link to="/login">Entrar para ver seu carrinho</Link>
          </Button>
        </div>
      ) : status !== "authenticated" ? (
        <p className="rounded-2xl border bg-card p-6 text-sm">
          Conclua a autenticação da sua conta para ver seu carrinho.
        </p>
      ) : cartsQuery.isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando seus carrinhos…
        </p>
      ) : cartsQuery.isError ? (
        <div className="space-y-3 rounded-2xl border bg-card p-6" role="alert">
          <p className="text-sm text-destructive">Não foi possível carregar seus carrinhos.</p>
          <Button type="button" variant="outline" onClick={() => void cartsQuery.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : page > 1 && carts.length === 0 ? (
        <div className="space-y-4 rounded-2xl border bg-card p-6 text-center">
          <p className="text-muted-foreground">Não há carrinhos nesta página.</p>
          <Button type="button" variant="outline" onClick={() => setPage((current) => current - 1)}>
            Voltar para a página anterior
          </Button>
        </div>
      ) : page === 1 && !carts.some((cart) => cart.items.length > 0) ? (
        <div className="space-y-6">
          <EmptyCartState />
          {hasPotentialNextPage && (
            <CartPagination
              page={page}
              hasPotentialNextPage={hasPotentialNextPage}
              onPrevious={() => setPage((current) => Math.max(1, current - 1))}
              onNext={() => setPage((current) => current + 1)}
            />
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {carts.map((cart) => (
            <BuyerCartSellerSection key={cart.id} cart={cart} />
          ))}
          <CartSecurityNotice />
          <CartPagination
            page={page}
            hasPotentialNextPage={hasPotentialNextPage}
            onPrevious={() => setPage((current) => Math.max(1, current - 1))}
            onNext={() => setPage((current) => current + 1)}
          />
        </div>
      )}
    </div>
  );
}

function CartPagination({
  page,
  hasPotentialNextPage,
  onPrevious,
  onNext,
}: {
  page: number;
  hasPotentialNextPage: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <nav className="flex items-center justify-center gap-3" aria-label="Paginação dos carrinhos">
      <Button type="button" variant="outline" disabled={page === 1} onClick={onPrevious}>
        Anterior
      </Button>
      <span className="text-sm text-muted-foreground">Página {page}</span>
      <Button type="button" variant="outline" disabled={!hasPotentialNextPage} onClick={onNext}>
        Próxima
      </Button>
    </nav>
  );
}
