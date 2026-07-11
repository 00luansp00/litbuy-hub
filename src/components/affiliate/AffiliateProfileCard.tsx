import { Link } from "@tanstack/react-router";
import { Users, ArrowRight } from "lucide-react";
import { formatBRL } from "@/lib/format";

interface Props {
  status: "active" | "pending_review" | "suspended" | "inactive";
  clicks: number;
  commissionAvailable: number;
}

const STATUS_LABEL: Record<Props["status"], string> = {
  active: "Ativo",
  pending_review: "Em análise",
  suspended: "Suspenso",
  inactive: "Inativo",
};

export function AffiliateProfileCard({ status, clicks, commissionAvailable }: Props) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Users className="h-4 w-4 text-primary" /> Programa de Afiliados
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Indique compradores e vendedores e acompanhe suas comissões.
      </p>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Status</dt>
          <dd className="font-semibold text-foreground">{STATUS_LABEL[status]}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Cliques</dt>
          <dd className="font-semibold text-foreground">{clicks.toLocaleString("pt-BR")}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Disponível</dt>
          <dd className="font-semibold text-foreground">{formatBRL(commissionAvailable)}</dd>
        </div>
      </dl>
      <Link
        to="/afiliados"
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        Abrir programa <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
