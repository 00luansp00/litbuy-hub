import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth/AuthGate";
import { SellerDashboardLayout } from "@/components/seller-dashboard/SellerDashboardLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatBrlMinor,
  formatOrderDate,
  fulfillmentState,
  paymentState,
  useSellerSales,
} from "@/services/orders";

type Search = { page?: number };
export const Route = createFileRoute("/vendedor/vendas")({
  validateSearch: (raw: Record<string, unknown>): Search => ({
    page:
      typeof raw.page === "number" &&
      Number.isSafeInteger(raw.page) &&
      raw.page >= 1 &&
      raw.page <= 10_000
        ? raw.page
        : 1,
  }),
  component: () => (
    <AuthGate title="Entre para acessar suas vendas">
      <Sales />
    </AuthGate>
  ),
});
export function Sales() {
  const page = Route.useSearch().page ?? 1;
  const navigate = useNavigate({ from: "/vendedor/vendas" });
  const query = useSellerSales(page, 20);
  return (
    <SellerDashboardLayout
      title="Vendas"
      description="Pedidos reais vinculados à sua conta Seller."
    >
      {query.isPending && (
        <div aria-live="polite">
          <span className="sr-only">Carregando vendas...</span>
          <Skeleton className="h-40" />
        </div>
      )}
      {query.isError && (
        <div role="alert" className="rounded-xl border p-6">
          Não foi possível carregar as vendas com segurança.{" "}
          <Button variant="outline" onClick={() => void query.refetch()}>
            Tentar novamente
          </Button>
        </div>
      )}
      {query.data?.items.length === 0 && (
        <div className="rounded-xl border p-8 text-center">
          <h2 className="font-semibold">Nenhuma venda encontrada</h2>
          <p className="text-sm text-muted-foreground">
            Quando houver pedidos reais, eles aparecerão aqui.
          </p>
        </div>
      )}
      {query.data && query.data.items.length > 0 && (
        <>
          <ul aria-label="Vendas do Seller" className="space-y-3">
            {query.data.items.map((sale) => (
              <li key={sale.orderCode} className="rounded-xl border p-5">
                <div className="flex justify-between gap-3">
                  <Link
                    to="/vendedor/vendas/$id"
                    params={{ id: sale.orderCode }}
                    className="font-semibold text-primary hover:underline"
                  >
                    {sale.orderCode}
                  </Link>
                  <strong>{formatBrlMinor(sale.saleAmountMinor)}</strong>
                </div>
                <p className="mt-2 text-sm">
                  {sale.items[0].productTitle}
                  {sale.items.length > 1 ? ` e mais ${sale.items.length - 1} item(ns)` : ""}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatOrderDate(sale.createdAt)} · Pagamento:{" "}
                  {paymentState[sale.paymentStatus][0]} · Entrega:{" "}
                  {fulfillmentState[sale.fulfillmentStatus][0]}
                </p>
              </li>
            ))}
          </ul>
          <nav aria-label="Paginação de vendas" className="mt-4 flex justify-between">
            <Button
              variant="outline"
              disabled={page <= 1}
              onClick={() => navigate({ search: { page: page - 1 } })}
            >
              Página anterior
            </Button>
            <span className="self-center text-sm">Página {page}</span>
            <Button
              variant="outline"
              disabled={query.data.items.length < query.data.limit}
              onClick={() => navigate({ search: { page: page + 1 } })}
            >
              Próxima página
            </Button>
          </nav>
        </>
      )}
    </SellerDashboardLayout>
  );
}
