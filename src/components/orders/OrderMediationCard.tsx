import { Gavel, ShieldAlert, FileText, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatBRL } from "@/lib/format";
import type { MediationCase, MediationStatus } from "@/types";

const STATUS_LABEL: Record<MediationStatus, string> = {
  none: "Sem mediação",
  opened: "Aberta",
  awaiting_buyer_evidence: "Aguardando provas do comprador",
  awaiting_seller_response: "Aguardando réplica do vendedor",
  under_review: "Em análise",
  resolved_buyer: "Resolvida em favor do comprador",
  resolved_seller: "Resolvida em favor do vendedor",
  refunded: "Reembolsada",
  closed: "Encerrada",
};

const STATUS_TONE: Record<MediationStatus, string> = {
  none: "bg-muted text-muted-foreground",
  opened: "bg-warning/15 text-warning border-warning/30",
  awaiting_buyer_evidence: "bg-warning/15 text-warning border-warning/30",
  awaiting_seller_response: "bg-warning/15 text-warning border-warning/30",
  under_review: "bg-primary/15 text-primary border-primary/30",
  resolved_buyer: "bg-success/15 text-success border-success/30",
  resolved_seller: "bg-success/15 text-success border-success/30",
  refunded: "bg-destructive/15 text-destructive border-destructive/30",
  closed: "bg-muted text-muted-foreground border-border",
};

interface Props {
  mediation: MediationCase;
  perspective: "buyer" | "seller";
}

export function OrderMediationCard({ mediation, perspective }: Props) {
  return (
    <section className="rounded-2xl border border-warning/30 bg-warning/5 p-5 shadow-card">
      <header className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Gavel className="h-5 w-5 text-warning" />
          <h3 className="text-lg font-bold text-foreground">Central de Mediação</h3>
        </div>
        <Badge className={STATUS_TONE[mediation.status]}>
          {STATUS_LABEL[mediation.status]}
        </Badge>
      </header>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Motivo</dt>
          <dd className="font-medium text-foreground">{mediation.reason}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Valor em disputa</dt>
          <dd className="font-medium text-foreground">
            {formatBRL(mediation.amountInDispute)}
          </dd>
        </div>
        {mediation.respondByAt && (
          <div className="col-span-2">
            <dt className="text-xs text-muted-foreground">Prazo de resposta</dt>
            <dd className="flex items-center gap-1 text-sm font-medium text-warning">
              <Clock className="h-3.5 w-3.5" />
              {new Date(mediation.respondByAt).toLocaleString("pt-BR")}
            </dd>
          </div>
        )}
      </dl>

      <Separator className="my-4" />

      <div>
        <h4 className="mb-2 text-sm font-semibold text-foreground">Timeline</h4>
        <ol className="space-y-1.5 text-xs">
          {mediation.timeline.map((e) => (
            <li key={e.id} className="flex items-start gap-2">
              <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
              <div>
                <div className="text-foreground">{e.label}</div>
                <div className="text-muted-foreground">
                  {new Date(e.at).toLocaleString("pt-BR")} · {e.actor}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <Separator className="my-4" />

      <div>
        <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <FileText className="h-4 w-4" /> Provas anexadas (mock)
        </h4>
        <ul className="space-y-1 text-xs">
          {mediation.evidence.map((ev) => (
            <li
              key={ev.id}
              className="flex items-center justify-between rounded-lg border border-border bg-background px-2 py-1.5"
            >
              <span className="text-foreground">
                <Badge variant="outline" className="mr-2 text-[10px]">
                  {ev.actor}
                </Badge>
                {ev.label}
              </span>
              <span className="text-[10px] text-muted-foreground">{ev.kind}</span>
            </li>
          ))}
        </ul>
      </div>

      {mediation.sellerResponse && (
        <>
          <Separator className="my-4" />
          <div>
            <h4 className="mb-1.5 text-sm font-semibold text-foreground">
              Réplica do vendedor
            </h4>
            <p className="rounded-lg border border-border bg-background p-2 text-xs text-foreground">
              {mediation.sellerResponse.text}
            </p>
          </div>
        </>
      )}

      {mediation.chatExcerpts && mediation.chatExcerpts.length > 0 && (
        <>
          <Separator className="my-4" />
          <div>
            <h4 className="mb-1.5 text-sm font-semibold text-foreground">
              Histórico usado na análise
            </h4>
            <ul className="space-y-1 text-xs">
              {mediation.chatExcerpts.map((c) => (
                <li
                  key={c.id}
                  className="rounded-lg border border-border bg-background px-2 py-1.5"
                >
                  <span className="mr-1 font-medium text-foreground">{c.author}:</span>
                  <span className="text-muted-foreground">{c.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <div className="mt-4 flex items-start gap-1.5 rounded-lg border border-border bg-background p-2 text-[11px] text-muted-foreground">
        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
        <span>
          {perspective === "buyer"
            ? "Envio de provas é demonstrativo. Upload real exigirá storage seguro e backend."
            : "Área demonstrativa. Decisão real exigirá backend com auditoria e RBAC."}
        </span>
      </div>
    </section>
  );
}
