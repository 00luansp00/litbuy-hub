import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth/AuthGate";
import { SellerDashboardLayout } from "@/components/seller-dashboard/SellerDashboardLayout";
import { SellerFinanceSummaryCard } from "@/components/seller-dashboard/SellerFinanceSummaryCard";
import { Button } from "@/components/ui/button";
import {
  balanceKeys,
  formatBrlMinor,
  useSellerFinanceActivity,
  useSellerFinanceSummary,
} from "@/services/finance/sellerFinance";

export const Route = createFileRoute("/vendedor/financeiro")({
  component: () => (
    <AuthGate
      title="Entre para acessar o financeiro"
      description="Você precisa estar logado para consultar os saldos internos."
    >
      <FinanceiroPage />
    </AuthGate>
  ),
});
const labels = {
  pendingMinor: "Pendente",
  heldMinor: "Em proteção",
  availableMinor: "Disponível internamente",
  reservedMinor: "Reservado",
  deficitMinor: "Déficit",
} as const;
const activityLabels: Record<string, string> = {
  SALE_RECOGNIZED: "Venda reconhecida",
  SELLER_FUNDS_HELD: "Valor movido para proteção",
  SELLER_FUNDS_RELEASED: "Valor liberado internamente",
};

export function FinanceiroPage() {
  const summary = useSellerFinanceSummary();
  const activity = useSellerFinanceActivity();
  return (
    <SellerDashboardLayout
      title="Financeiro"
      description="Saldos internos e movimentações registradas no ledger da sua conta Seller."
    >
      <div className="rounded-xl border border-border bg-card p-4 text-sm">
        Valores disponíveis nesta tela são saldos internos do Alpha e não representam saque ou
        payout habilitado.
      </div>
      {summary.isPending ? (
        <div aria-label="Carregando saldos" className="h-40 animate-pulse rounded-2xl bg-card" />
      ) : summary.isError ? (
        <div role="alert" className="rounded-xl border border-destructive p-4">
          Não foi possível carregar os saldos financeiros.
        </div>
      ) : (
        <SellerFinanceSummaryCard financial={summary.data} />
      )}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h2 className="text-lg font-bold">Atividade financeira</h2>
        {activity.isPending ? (
          <p className="mt-4 text-sm text-muted-foreground">Carregando movimentações…</p>
        ) : activity.isError ? (
          <p role="alert" className="mt-4 text-sm text-destructive">
            Não foi possível carregar a atividade financeira.
          </p>
        ) : activity.data.pages.flatMap((p) => p.items).length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Nenhuma movimentação financeira registrada.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {activity.data.pages
              .flatMap((p) => p.items)
              .map((item) => (
                <li key={item.id} className="py-4">
                  <div className="flex justify-between gap-3">
                    <strong>{activityLabels[item.type] ?? "Movimentação financeira"}</strong>
                    <time className="text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(item.createdAt))}
                    </time>
                  </div>
                  <dl className="mt-2 space-y-1">
                    {balanceKeys
                      .filter((key) => BigInt(item.movements[key]) !== 0n)
                      .map((key) => (
                        <div key={key} className="flex justify-between text-sm">
                          <dt>{labels[key]}</dt>
                          <dd>{formatBrlMinor(item.movements[key], true)}</dd>
                        </div>
                      ))}
                  </dl>
                </li>
              ))}
          </ul>
        )}
        {activity.hasNextPage && (
          <Button
            className="mt-4"
            variant="outline"
            disabled={activity.isFetchingNextPage}
            onClick={() => activity.fetchNextPage()}
          >
            {activity.isFetchingNextPage ? "Carregando…" : "Carregar mais"}
          </Button>
        )}
        {activity.isFetchNextPageError && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            Não foi possível carregar mais movimentações.
          </p>
        )}
      </section>
    </SellerDashboardLayout>
  );
}
