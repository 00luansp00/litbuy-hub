import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth/AuthGate";
import { AccountLayout } from "@/components/account/AccountLayout";
import { BuyerOrderErrorState } from "@/components/orders/BuyerOrderErrorState";
import { BuyerOrderList } from "@/components/orders/BuyerOrderList";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ORDER_STATUSES, orderState, useBuyerOrders, type OrderStatus } from "@/services/orders";

type Search = { page?: number; status?: OrderStatus };
export function parseOrderPage(value: unknown): number {
  const parsed = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  return typeof parsed === "number" &&
    Number.isSafeInteger(parsed) &&
    parsed >= 1 &&
    parsed <= 10_000
    ? parsed
    : 1;
}
export function parseOrderStatus(value: unknown): OrderStatus | undefined {
  return typeof value === "string" && ORDER_STATUSES.includes(value as OrderStatus)
    ? (value as OrderStatus)
    : undefined;
}

export const Route = createFileRoute("/pedidos")({
  validateSearch: (raw: Record<string, unknown>): Search => ({
    page: parseOrderPage(raw.page),
    status: parseOrderStatus(raw.status),
  }),
  component: PedidosPage,
});
function PedidosPage() {
  return (
    <AuthGate>
      <PedidosContent />
    </AuthGate>
  );
}
export function PedidosContent() {
  const search = Route.useSearch();
  const page = search.page ?? 1;
  const status = search.status;
  const navigate = useNavigate({ from: "/pedidos" });
  const query = useBuyerOrders(page, 20, status);
  const go = (nextPage: number, nextStatus = status) =>
    navigate({ search: { page: nextPage, status: nextStatus } });
  return (
    <AccountLayout
      title="Meus pedidos"
      description="Pedidos registrados pela API para esta conta."
      actions={
        <label className="text-sm">
          Status{" "}
          <select
            className="ml-2 rounded-md border bg-background p-2"
            value={status ?? ""}
            onChange={(e) => go(1, e.target.value ? (e.target.value as OrderStatus) : undefined)}
          >
            <option value="">Todos</option>
            {ORDER_STATUSES.map((value) => (
              <option key={value} value={value}>
                {orderState[value][0]}
              </option>
            ))}
          </select>
        </label>
      }
    >
      {query.isPending && (
        <div aria-live="polite">
          <span className="sr-only">Carregando pedidos...</span>
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="mb-3 h-28" />
          ))}
        </div>
      )}
      {query.isError && <BuyerOrderErrorState retry={() => void query.refetch()} />}
      {query.data && query.data.items.length === 0 && (
        <div className="rounded-xl border p-8 text-center">
          <h3 className="font-semibold">
            {page > 1 ? "Esta página não possui pedidos" : "Nenhum pedido encontrado"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {page > 1
              ? "Volte à página anterior para continuar."
              : "Quando houver pedidos, eles aparecerão aqui."}
          </p>
          {page > 1 && (
            <Button className="mt-4" variant="outline" onClick={() => go(page - 1)}>
              Voltar uma página
            </Button>
          )}
        </div>
      )}
      {query.data && query.data.items.length > 0 && (
        <>
          <BuyerOrderList orders={query.data.items} />
          <nav aria-label="Paginação de pedidos" className="flex justify-between">
            <Button variant="outline" disabled={page <= 1} onClick={() => go(page - 1)}>
              Página anterior
            </Button>
            <span className="self-center text-sm">Página {page}</span>
            <Button
              variant="outline"
              disabled={query.data.items.length < query.data.limit}
              onClick={() => go(page + 1)}
            >
              Próxima página
            </Button>
          </nav>
        </>
      )}
    </AccountLayout>
  );
}
