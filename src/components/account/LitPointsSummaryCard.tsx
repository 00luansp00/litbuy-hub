import { Link } from "@tanstack/react-router";
import { Coins, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { litPointsService } from "@/services/litPointsService";
import type { LitPointsBalance } from "@/types";

/**
 * LitPointsSummaryCard — cartão visual do saldo LIT Points.
 *
 * LIT Points são pontos de recompensa demonstrativos. Não são dinheiro
 * e não podem ser sacados como saldo.
 */
export function LitPointsSummaryCard({ compact = false }: { compact?: boolean }) {
  const [balance, setBalance] = useState<LitPointsBalance | null>(null);

  useEffect(() => {
    litPointsService.getLitPointsBalance().then(setBalance);
  }, []);

  return (
    <section
      aria-label="Saldo LIT Points"
      className="rounded-2xl border border-border bg-card p-5 shadow-card"
    >
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent/12 text-accent">
            <Coins className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-base font-semibold text-foreground">LIT Points</h3>
            <p className="text-[11px] text-muted-foreground">Programa próprio LIT Buy — demonstrativo</p>
          </div>
        </div>
        <Link
          to="/lit-points"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Ver programa <ArrowRight className="h-3 w-3" />
        </Link>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Metric label="Total" value={balance?.total ?? 0} />
        <Metric label="Pendentes" value={balance?.pending ?? 0} />
        <Metric label="Mês" value={balance?.earnedThisMonth ?? 0} />
      </div>

      {!compact && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Saldo LIT é valor financeiro demonstrativo. LIT Points são pontos de recompensa demonstrativos.
        </p>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface/50 p-3 text-center">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-bold text-foreground">{value.toLocaleString("pt-BR")}</div>
    </div>
  );
}
