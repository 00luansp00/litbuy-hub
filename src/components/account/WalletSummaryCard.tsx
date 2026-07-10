import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Plus,
  Wallet as WalletIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { WalletSummary } from "@/types";

interface WalletSummaryCardProps {
  wallet: WalletSummary;
  className?: string;
  /** Mostra o histórico completo (usado em /carteira). */
  showAll?: boolean;
  hideHeader?: boolean;
}

export function WalletSummaryCard({
  wallet,
  className,
  showAll,
  hideHeader,
}: WalletSummaryCardProps) {
  const list = showAll ? wallet.transactions : wallet.transactions.slice(0, 4);

  const handleWithdraw = () =>
    toast("Saque em breve", {
      description: "O saque de saldo será liberado em uma próxima sprint.",
    });
  const handleAdd = () =>
    toast("Depósito em breve", {
      description: "A recarga de saldo será liberada em uma próxima sprint.",
    });

  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card p-5 shadow-card md:p-6",
        className,
      )}
      aria-label="Resumo da carteira"
    >
      {!hideHeader && (
        <header className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className="grid h-9 w-9 place-items-center rounded-xl text-success"
              style={{ background: "color-mix(in oklab, var(--success) 12%, transparent)" }}
            >
              <WalletIcon className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Carteira LIT
              </h3>
              <p className="text-xs text-muted-foreground">
                Saldo interno protegido.
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/carteira">
              Ver <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </header>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-surface/60 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Saldo disponível
          </p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {formatBRL(wallet.balance)}
          </p>
        </div>
        <div className="rounded-xl bg-surface/60 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            A liberar
          </p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {formatBRL(wallet.pending)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Button className="flex-1" onClick={handleAdd}>
          <Plus className="h-4 w-4" /> Adicionar saldo
        </Button>
        <Button variant="outline" className="flex-1" onClick={handleWithdraw}>
          <ArrowUpRight className="h-4 w-4" /> Sacar
        </Button>
      </div>

      <Separator className="my-5" />

      <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">
        Últimas transações
      </p>
      <ul className="space-y-2.5">
        {list.map((t) => {
          const positive = t.amount >= 0;
          return (
            <li
              key={t.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface/40 p-3"
            >
              <span
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                  positive ? "bg-success/12 text-success" : "bg-destructive/12 text-destructive",
                )}
              >
                {positive ? (
                  <ArrowDownLeft className="h-4 w-4" />
                ) : (
                  <ArrowUpRight className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {t.description}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(t.createdAt).toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 text-sm font-semibold",
                  positive ? "text-success" : "text-destructive",
                )}
              >
                {positive ? "+" : ""}
                {formatBRL(t.amount)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
