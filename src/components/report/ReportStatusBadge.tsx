import { Badge } from "@/components/ui/badge";
import type { ReportStatus } from "@/types";

const LABEL: Record<ReportStatus, string> = {
  draft: "Rascunho",
  submitted: "Enviada",
  under_review: "Em análise",
  action_required: "Ação necessária",
  resolved: "Resolvida",
  rejected: "Rejeitada",
  closed: "Encerrada",
};

const TONE: Record<ReportStatus, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  submitted: "bg-primary/15 text-primary border-primary/30",
  under_review: "bg-warning/15 text-warning border-warning/30",
  action_required: "bg-orange-500/15 text-orange-500 border-orange-500/30",
  resolved: "bg-success/15 text-success border-success/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  closed: "bg-muted text-muted-foreground border-border",
};

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  return (
    <Badge variant="outline" className={TONE[status]}>
      {LABEL[status]}
    </Badge>
  );
}
