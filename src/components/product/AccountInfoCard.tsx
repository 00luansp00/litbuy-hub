import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ListingAccountInfo } from "@/types";

const PROVENANCE_LABEL: Record<string, string> = {
  original_owner: "Dono original",
  reseller: "Revendedor",
  third_party: "Terceiro",
  other: "Outros",
};

const RECOVERY_LABEL: Record<string, string> = {
  full: "Recuperação total",
  partial: "Recuperação parcial",
  none: "Sem recuperação",
  unknown: "Não informada",
};

const RISK_LABEL: Record<string, { label: string; className: string }> = {
  low: { label: "Baixo risco", className: "bg-success/15 text-success" },
  medium: { label: "Risco médio", className: "bg-warning/15 text-warning" },
  high: { label: "Alto risco", className: "bg-destructive/15 text-destructive" },
};

interface AccountInfoCardProps {
  info: ListingAccountInfo;
}

/**
 * AccountInfoCard — mostra informações declaradas do anúncio tipo Conta.
 * Não exibe credenciais, login, senha ou dado sensível real.
 */
export function AccountInfoCard({ info }: AccountInfoCardProps) {
  const risk = info.recoveryRisk ? RISK_LABEL[info.recoveryRisk] : null;
  const items: { label: string; value: string }[] = [];
  if (info.provenance) {
    items.push({ label: "Procedência", value: PROVENANCE_LABEL[info.provenance] ?? info.provenance });
  }
  if (info.recoveryLevel) {
    items.push({
      label: "Dados de recuperação",
      value: RECOVERY_LABEL[info.recoveryLevel] ?? info.recoveryLevel,
    });
  }
  items.push({ label: "E-mail verificado", value: info.emailVerified ? "Sim" : "Não" });
  items.push({ label: "Telefone vinculado", value: info.phoneLinked ? "Sim" : "Não" });
  items.push({ label: "Documento vinculado", value: info.documentLinked ? "Sim" : "Não" });
  items.push({ label: "Acesso completo", value: info.fullAccess ? "Sim" : "Parcial" });

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Informações da conta
          </h3>
        </div>
        {risk && (
          <Badge className={risk.className} variant="secondary">
            {risk.label}
          </Badge>
        )}
      </header>

      <dl className="grid grid-cols-2 gap-2 text-xs">
        {items.map((it) => (
          <div key={it.label} className="rounded-lg bg-surface/60 p-2">
            <dt className="text-muted-foreground">{it.label}</dt>
            <dd className="font-semibold text-foreground">{it.value}</dd>
          </div>
        ))}
      </dl>

      {info.warrantyNote && (
        <p className="rounded-lg border border-border bg-surface/40 p-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Garantia informada: </span>
          {info.warrantyNote}
        </p>
      )}

      <p className="flex items-start gap-1.5 text-[11px] text-warning">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Contas digitais possuem risco de recuperação. Confira as informações do
        anúncio e mantenha a negociação dentro da LIT Buy.
      </p>
    </section>
  );
}
