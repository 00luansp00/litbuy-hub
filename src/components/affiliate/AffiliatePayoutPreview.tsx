import { Wallet } from "lucide-react";
import { formatBRL } from "@/lib/format";
import type { AffiliatePayoutPreview as PayoutPreview } from "@/types";

export function AffiliatePayoutPreview({ preview }: { preview: PayoutPreview }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Wallet className="h-4 w-4 text-primary" /> Prévia de saque
      </div>
      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Elegível para saque</dt>
          <dd className="text-sm font-semibold text-foreground">
            {formatBRL(preview.eligibleAmount)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Valor mínimo</dt>
          <dd className="text-sm font-semibold text-foreground">
            {formatBRL(preview.minimumPayout)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Processamento estimado</dt>
          <dd className="text-sm font-semibold text-foreground">
            até {preview.estimatedProcessingDays} dias úteis
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">KYC obrigatório</dt>
          <dd className="text-sm font-semibold text-foreground">
            {preview.requiresKyc ? "Sim" : "Não"}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-[11px] text-muted-foreground">{preview.note}</p>
    </div>
  );
}
