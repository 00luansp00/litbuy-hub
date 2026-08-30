import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth/AuthGate";
import { Breadcrumb } from "@/components/common/Breadcrumb";
import { BuyerOrderAmounts } from "@/components/orders/BuyerOrderAmounts";
import { BuyerOrderErrorState } from "@/components/orders/BuyerOrderErrorState";
import { BuyerOrderItems } from "@/components/orders/BuyerOrderItems";
import { BuyerOrderStateSummary } from "@/components/orders/BuyerOrderStateSummary";
import { BuyerOrderStatusBadge } from "@/components/orders/BuyerOrderStatusBadge";
import { OrderChatCard } from "@/components/orders/OrderChatCard";
import { BuyerReportProblemCard } from "@/components/orders/BuyerReportProblemCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { formatOrderDate, useBuyerOrder, useConfirmBuyerOrderReceipt } from "@/services/orders";
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
export function OrderDetailContent({ orderCode }: { orderCode: string }) {
  const query = useBuyerOrder(orderCode);
  const confirmReceipt = useConfirmBuyerOrderReceipt(orderCode);
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
    if (notFound)
      return (
        <div role="alert" className="container-lit py-10">
          <h1 className="text-xl font-bold">Pedido indisponível</h1>
          <p className="mt-2">Pedido não encontrado ou indisponível para esta conta.</p>
          <Link to="/pedidos" className="mt-4 inline-block text-primary hover:underline">
            Voltar para Meus pedidos
          </Link>
        </div>
      );
    return (
      <div className="container-lit py-10">
        <BuyerOrderErrorState
          message="Não foi possível carregar o pedido com segurança."
          retry={() => void query.refetch()}
        />
      </div>
    );
  }
  const order = query.data;
  const canConfirm =
    order.status === "ACTIVE" &&
    order.paymentStatus === "PAID" &&
    order.fulfillmentStatus === "AWAITING_BUYER_CONFIRMATION" &&
    !["OPEN", "UNDER_REVIEW"].includes(order.disputeStatus);
  const canChat = order.paymentStatus === "PAID" && ["ACTIVE", "COMPLETED"].includes(order.status);
  const confirmationError = confirmReceipt.isError
    ? confirmReceipt.error instanceof ApiError &&
      [
        "ACTIVE_DISPUTE",
        "FULFILLMENT_STATE_MISMATCH",
        "ORDER_STATE_MISMATCH",
        "PAYMENT_NOT_PAID",
      ].includes(confirmReceipt.error.code)
      ? "O pedido não está disponível para confirmação. Atualizamos o estado para você tentar novamente."
      : "Não foi possível confirmar o recebimento. Verifique o estado do pedido e tente novamente."
    : null;
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
      <BuyerReportProblemCard order={order} />
      {canConfirm && (
        <section aria-labelledby="confirm-receipt-title" className="rounded-xl border p-5">
          <h2 id="confirm-receipt-title" className="text-lg font-bold">
            Confirmar entrega
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Confirme somente depois de realmente ter recebido a entrega.
          </p>
          <Button
            className="mt-4"
            disabled={confirmReceipt.isPending}
            onClick={() => confirmReceipt.mutate()}
          >
            {confirmReceipt.isPending ? "Confirmando..." : "Confirmar recebimento"}
          </Button>
        </section>
      )}
      {confirmationError && (
        <p role="alert" className="text-sm text-destructive">
          {confirmationError}
        </p>
      )}
      {order.status === "PENDING_PAYMENT" &&
        ["NOT_CREATED", "PENDING"].includes(order.paymentStatus) && (
          <Button asChild>
            <Link to="/pagamento/$id" params={{ id: order.orderCode }}>
              Ir para pagamento Alpha
            </Link>
          </Button>
        )}
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
      {canChat && (
        <OrderChatCard
          orderCode={order.orderCode}
          perspective="buyer"
          counterpartLabel={order.seller.storeName}
        />
      )}
    </main>
  );
}
