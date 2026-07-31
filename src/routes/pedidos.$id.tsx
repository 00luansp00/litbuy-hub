import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth/AuthGate";
import { Breadcrumb } from "@/components/common/Breadcrumb";
import { BuyerOrderAmounts } from "@/components/orders/BuyerOrderAmounts";
import { BuyerOrderErrorState } from "@/components/orders/BuyerOrderErrorState";
import { BuyerOrderItems } from "@/components/orders/BuyerOrderItems";
import { BuyerOrderStateSummary } from "@/components/orders/BuyerOrderStateSummary";
import { BuyerOrderStatusBadge } from "@/components/orders/BuyerOrderStatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { formatOrderDate, useBuyerOrder } from "@/services/orders";
export const Route = createFileRoute("/pedidos/$id")({ component: OrderDetailPage });
function OrderDetailPage() {
  const { id } = Route.useParams();
  return (
    <AuthGate
      title="Entre para acessar o pedido"
      description="Você precisa estar logado para ver os detalhes do pedido."
    >
      <OrderDetailContent orderCode={id} />
    </AuthGate>
  );
}
function OrderDetailContent({ orderCode }: { orderCode: string }) {
  const query = useBuyerOrder(orderCode);
  if (query.isPending)
    return (
      <div className="container-lit py-10" aria-live="polite">
        <span className="sr-only">Carregando pedido...</span>
        <Skeleton className="h-48" />
      </div>
    );
  if (query.isError) {
    const notFound =
      (query.error instanceof ApiError && query.error.status === 404) ||
      query.error instanceof TypeError;
    return (
      <div className="container-lit py-10">
        <BuyerOrderErrorState
          message={
            notFound
              ? "Pedido não encontrado ou indisponível para esta conta."
              : "Não foi possível carregar o pedido com segurança."
          }
          retry={() => void query.refetch()}
        />
      </div>
    );
  }
  const order = query.data;
  return (
    <main className="container-lit space-y-6 py-6 md:py-10">
      <Breadcrumb
        items={[
          { label: "Home", to: "/" },
          { label: "Meus pedidos", to: "/pedidos" },
          { label: order.orderCode },
        ]}
      />
      <header className="space-y-2">
        <BuyerOrderStatusBadge status={order.status} />
        <h1 className="text-2xl font-bold">Pedido {order.orderCode}</h1>
        <p className="text-sm text-muted-foreground">
          Criado em {formatOrderDate(order.createdAt)}
        </p>
        {order.status === "PENDING_PAYMENT" && (
          <p className="text-sm">Expira em {formatOrderDate(order.expiresAt)}</p>
        )}
        {order.expiredAt && (
          <p className="text-sm">Expirado em {formatOrderDate(order.expiredAt)}</p>
        )}
        {order.cancelledAt && (
          <p className="text-sm">Cancelado em {formatOrderDate(order.cancelledAt)}</p>
        )}
      </header>
      <BuyerOrderStateSummary order={order} />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section aria-labelledby="seller-title" className="rounded-xl border p-5">
            <h2 id="seller-title" className="text-xl font-bold">
              Seller histórico
            </h2>
            <p className="mt-2 font-semibold">{order.seller.storeName}</p>
            <Link
              to="/loja/$slug"
              params={{ slug: order.seller.slug }}
              className="text-sm text-primary hover:underline"
            >
              /{order.seller.slug}
            </Link>
            <p className="mt-2 text-xs text-muted-foreground">
              Seller registrado no momento do pedido.
            </p>
          </section>
          <BuyerOrderItems items={order.items} />
        </div>
        <BuyerOrderAmounts order={order} />
      </div>
    </main>
  );
}
