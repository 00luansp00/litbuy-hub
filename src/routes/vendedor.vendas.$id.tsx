import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth/AuthGate";
import { SellerDashboardLayout } from "@/components/seller-dashboard/SellerDashboardLayout";
import { BuyerOrderItems } from "@/components/orders/BuyerOrderItems";
import { OrderChatCard } from "@/components/orders/OrderChatCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import {
  disputeState,
  formatBrlMinor,
  formatOrderDate,
  fulfillmentState,
  orderState,
  paymentState,
  useMarkSellerSaleDelivered,
  useSellerSale,
} from "@/services/orders";
export const Route = createFileRoute("/vendedor/vendas/$id")({ component: Page });
function Page() {
  const { id } = Route.useParams();
  return (
    <AuthGate title="Entre para acessar suas vendas">
      <Detail orderCode={id} />
    </AuthGate>
  );
}
export function Detail({ orderCode }: { orderCode: string }) {
  const query = useSellerSale(orderCode);
  const delivery = useMarkSellerSaleDelivered(orderCode);
  if (query.isPending)
    return (
      <SellerDashboardLayout title="Venda">
        <span className="sr-only">Carregando venda...</span>
        <Skeleton className="h-48" />
      </SellerDashboardLayout>
    );
  if (query.isError) {
    const hidden =
      (query.error instanceof ApiError && query.error.status === 404) ||
      query.error instanceof TypeError;
    return (
      <SellerDashboardLayout title="Venda indisponível">
        <div role="alert">
          <p>
            {hidden
              ? "Venda não encontrada ou indisponível para esta conta."
              : "Não foi possível carregar a venda com segurança."}
          </p>
          <Link to="/vendedor/vendas" className="text-primary hover:underline">
            Voltar para vendas
          </Link>
        </div>
      </SellerDashboardLayout>
    );
  }
  const sale = query.data;
  const canDeliver =
    sale.status === "ACTIVE" &&
    sale.paymentStatus === "PAID" &&
    sale.fulfillmentStatus === "AWAITING_SELLER" &&
    !(["OPEN", "UNDER_REVIEW"] as string[]).includes(sale.disputeStatus);
  const canChat = sale.paymentStatus === "PAID" && ["ACTIVE", "COMPLETED"].includes(sale.status);
  const states = [
    ["Pedido", ...orderState[sale.status]],
    ["Pagamento", ...paymentState[sale.paymentStatus]],
    ["Entrega", ...fulfillmentState[sale.fulfillmentStatus]],
    ["Disputa", ...disputeState[sale.disputeStatus]],
  ] as const;
  return (
    <SellerDashboardLayout
      title={`Venda ${sale.orderCode}`}
      description={`Criada em ${formatOrderDate(sale.createdAt)}`}
    >
      <div className="space-y-6">
        <section>
          <h2 className="text-xl font-bold">Estados persistidos</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            {states.map(([kind, label, description]) => (
              <div key={kind} className="rounded-xl border p-4">
                <dt className="text-xs uppercase text-muted-foreground">{kind}</dt>
                <dd className="font-semibold">{label}</dd>
                <dd className="text-sm text-muted-foreground">{description}</dd>
              </div>
            ))}
          </dl>
        </section>
        {canDeliver && (
          <section className="rounded-xl border p-5">
            <h2 className="text-lg font-bold">Registrar entrega</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Esta ação registra que a entrega foi realizada. O pedido seguirá para a próxima etapa
              persistida pelo backend.
            </p>
            <Button
              className="mt-4"
              disabled={delivery.isPending}
              onClick={() => delivery.mutate()}
            >
              {delivery.isPending ? "Registrando..." : "Marcar como entregue"}
            </Button>
          </section>
        )}
        {delivery.isError && (
          <p role="alert" className="text-sm text-destructive">
            Não foi possível registrar a entrega. O estado da venda foi atualizado; verifique e
            tente novamente.
          </p>
        )}
        <BuyerOrderItems items={sale.items} />
        <section className="rounded-xl border p-5">
          <h2 className="text-xl font-bold">Valor da venda</h2>
          <p className="mt-2 font-bold">{formatBrlMinor(sale.saleAmountMinor)}</p>
        </section>
        {canChat && (
          <OrderChatCard
            orderCode={sale.orderCode}
            perspective="seller"
            counterpartLabel="Comprador"
          />
        )}
      </div>
    </SellerDashboardLayout>
  );
}
