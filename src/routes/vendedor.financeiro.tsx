import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { AuthGate } from "@/components/auth/AuthGate";
import { SellerDashboardLayout } from "@/components/seller-dashboard/SellerDashboardLayout";
import { SellerFinancialCard } from "@/components/seller-dashboard/SellerFinancialCard";
import { EmptyState } from "@/components/common/EmptyState";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/format";
import { sellerDashboardService } from "@/services/sellerDashboardService";
import type { SellerFinancialSummary } from "@/types";

export const Route = createFileRoute("/vendedor/financeiro")({
  component: () => (
    <AuthGate
      title="Entre para acessar o financeiro"
      description="Você precisa estar logado para ver seu saldo e histórico."
    >
      <FinanceiroPage />
    </AuthGate>
  ),
});

function FinanceiroPage() {
  const [financial, setFinancial] = useState<SellerFinancialSummary | null>(null);

  useEffect(() => {
    let mounted = true;
    sellerDashboardService.getSellerFinancialSummary().then((f) => {
      if (mounted) setFinancial(f);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (!financial) {
    return (
      <SellerDashboardLayout title="Financeiro">
        <div className="h-40 animate-pulse rounded-2xl border border-border bg-card" />
      </SellerDashboardLayout>
    );
  }

  return (
    <SellerDashboardLayout
      title="Financeiro"
      description="Saldo, taxas e repasses fictícios — nenhum valor real."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <SellerFinancialCard financial={financial} />
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <header className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-foreground">Histórico de repasses</h3>
              <p className="text-xs text-muted-foreground">
                Movimentações fictícias apenas para preview.
              </p>
            </div>
            <Badge variant="secondary" className="text-[10px]">Demo</Badge>
          </header>
          {financial.movements.length === 0 ? (
            <EmptyState
              icon="Wallet"
              title="Sem movimentações"
              description="As movimentações aparecerão aqui quando houver vendas."
            />
          ) : (
            <ul className="divide-y divide-border">
              {financial.movements.map((m) => {
                const positive = m.amount >= 0;
                return (
                  <li
                    key={m.id}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                        positive
                          ? "bg-success/10 text-success"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {positive ? (
                        <ArrowUpRight className="h-4 w-4" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-1 text-sm font-medium text-foreground">
                        {m.description}
                      </div>
                      <div className="text-[11px] uppercase text-muted-foreground">
                        {new Date(m.createdAt).toLocaleString("pt-BR")}
                      </div>
                    </div>
                    <div
                      className={`text-sm font-semibold ${
                        positive ? "text-success" : "text-destructive"
                      }`}
                    >
                      {positive ? "+" : ""}
                      {formatBRL(m.amount)}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </SellerDashboardLayout>
  );
}
