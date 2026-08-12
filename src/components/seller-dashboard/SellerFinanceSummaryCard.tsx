import { Wallet } from "lucide-react";
import { formatBrlMinor, type SellerFinanceSummary } from "@/services/finance/sellerFinance";

const buckets = [
  ["pendingMinor", "Pendente"],
  ["heldMinor", "Em proteção"],
  ["availableMinor", "Disponível internamente"],
  ["reservedMinor", "Reservado"],
  ["deficitMinor", "Déficit"],
] as const;
export function SellerFinanceSummaryCard({
  financial,
  compact = false,
}: {
  financial: SellerFinanceSummary;
  compact?: boolean;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <header className="mb-4">
        <h3 className="flex items-center gap-2 text-lg font-bold">
          <Wallet className="h-4 w-4" /> Financeiro
        </h3>
        <p className="text-xs text-muted-foreground">Saldos internos registrados no ledger.</p>
      </header>
      <div className={`grid gap-3 ${compact ? "grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
        {buckets.map(([key, label]) => (
          <div key={key} className="rounded-xl border border-border bg-surface/60 p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="mt-1 font-bold">{formatBrlMinor(financial.balances[key])}</div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Disponível internamente é um bucket do ledger Alpha; não representa retirada habilitada.
      </p>
    </section>
  );
}
