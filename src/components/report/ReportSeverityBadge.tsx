import { Badge } from "@/components/ui/badge";
import type { ReportSeverity } from "@/types";

const LABEL: Record<ReportSeverity, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
};

const TONE: Record<ReportSeverity, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-warning/15 text-warning border-warning/30",
  high: "bg-orange-500/15 text-orange-500 border-orange-500/30",
  critical: "bg-destructive/15 text-destructive border-destructive/30",
};

export function ReportSeverityBadge({ severity }: { severity: ReportSeverity }) {
  return (
    <Badge variant="outline" className={TONE[severity]}>
      Risco: {LABEL[severity]}
    </Badge>
  );
}
