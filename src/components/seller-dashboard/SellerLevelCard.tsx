import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Award, Crown, Gem, Medal, Trophy, ArrowRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { sellerLevelService } from "@/services/sellerLevelService";
import type { SellerLevel, SellerLevelProgress } from "@/types";

const iconMap: Record<string, typeof Medal> = { Medal, Award, Crown, Gem, Trophy };

/**
 * SellerLevelCard — cartão visual do nível do vendedor com progresso.
 * Mock. Regras reais dependem de backend.
 */
export function SellerLevelCard({ sellerId = "me" }: { sellerId?: string }) {
  const [level, setLevel] = useState<SellerLevel | null>(null);
  const [progress, setProgress] = useState<SellerLevelProgress | null>(null);

  useEffect(() => {
    Promise.all([
      sellerLevelService.getSellerLevelBySellerId(sellerId),
      sellerLevelService.getSellerLevelProgress(sellerId),
    ]).then(([l, p]) => {
      setLevel(l);
      setProgress(p);
    });
  }, [sellerId]);

  if (!level || !progress) {
    return <div className="h-40 animate-pulse rounded-2xl border border-border bg-card" />;
  }

  const Icon = iconMap[level.icon] ?? Medal;

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`grid h-9 w-9 place-items-center rounded-xl bg-primary/10 ${level.color}`}>
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-base font-semibold text-foreground">Meu nível de vendedor</h3>
            <p className="text-[11px] text-muted-foreground">{level.tagline}</p>
          </div>
        </div>
        <Link to="/taxas" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          Ver benefícios <ArrowRight className="h-3 w-3" />
        </Link>
      </header>

      <div className="mb-3">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-muted-foreground">
            Nível atual: <strong className={level.color}>{level.name}</strong>
          </span>
          {progress.next && (
            <span className="text-muted-foreground">
              Próximo: <strong className="text-foreground">{progress.next}</strong>
            </span>
          )}
        </div>
        <Progress value={progress.progressToNext} className="mt-2 h-2" />
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <Stat label="Vendas" value={String(progress.completedSales)} />
        <Stat label="Avaliação +" value={`${progress.positiveReviews}%`} />
        <Stat label="Disputas" value={`${progress.disputeRate}%`} />
        <Stat label="No prazo" value={`${progress.onTimeRate}%`} />
      </div>

      <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <div>
          Taxa demonstrativa: <strong className="text-foreground">{level.fee.platformFeePercent}%</strong>
        </div>
        <div>
          Liberação de saldo: <strong className="text-foreground">{level.payout.releaseHours}h</strong>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface/50 p-2 text-center">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}
