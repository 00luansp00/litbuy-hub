import { toast } from "sonner";
import { Wallet, Clock, CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import { affiliateService } from "@/services/affiliateService";
import { analyticsService } from "@/services/analyticsService";
import type { AffiliateCommissionSummary } from "@/types";

export function AffiliateCommissionCard({
  summary,
}: {
  summary: AffiliateCommissionSummary;
}) {
  const eligible = summary.available >= summary.minimumPayout;

  async function handlePayout() {
    await affiliateService.simulateRequestCommissionPayout();
    analyticsService.track("affiliate_payout_requested_mocked", {
      amount: summary.available,
    });
    toast("Saque solicitado (mock)", {
      description:
        "Saque real exige backend financeiro, verificação de identidade e integração bancária.",
    });
  }

  const stats = [
    { icon: Clock, label: "Pendente", value: summary.pending, tone: "text-warning" },
    { icon: Wallet, label: "Disponível", value: summary.available, tone: "text-success" },
    { icon: CheckCircle2, label: "Paga", value: summary.paid, tone: "text-primary" },
    { icon: XCircle, label: "Cancelada", value: summary.cancelled, tone: "text-muted-foreground" },
    { icon: RotateCcw, label: "Estornada", value: summary.reversed, tone: "text-destructive" },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Minhas comissões</h3>
          <p className="text-xs text-muted-foreground">
            Valor mínimo para saque: {formatBRL(summary.minimumPayout)}.
            {summary.nextForecast &&
              ` Próxima liberação prevista: ${new Date(summary.nextForecast).toLocaleDateString("pt-BR")}.`}
          </p>
        </div>
        <Button size="sm" disabled={!eligible} onClick={handlePayout}>
          Solicitar saque
        </Button>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-lg border border-border bg-surface/40 p-3">
              <div className={`flex items-center gap-1 text-[11px] uppercase ${s.tone}`}>
                <Icon className="h-3 w-3" /> {s.label}
              </div>
              <div className="mt-1 text-sm font-semibold text-foreground">
                {formatBRL(s.value)}
              </div>
            </div>
          );
        })}
      </div>

      {!eligible && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Você ainda não atingiu o valor mínimo para saque demonstrativo.
        </p>
      )}
    </div>
  );
}
