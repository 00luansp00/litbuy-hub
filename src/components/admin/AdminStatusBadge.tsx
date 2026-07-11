import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AdminStatus } from "@/types";

const LABELS: Record<AdminStatus, string> = {
  active: "Ativo",
  suspended: "Suspenso",
  in_review: "Em análise",
  blocked: "Bloqueado",
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Recusado",
  paused: "Pausado",
  removed: "Removido",
  sold: "Vendido",
  paid: "Pago",
  delivered: "Em entrega",
  completed: "Concluído",
  cancelled: "Cancelado",
  in_dispute: "Em disputa",
  refunded: "Estornado",
  awaiting_payment: "Aguard. pagamento",
  awaiting_buyer: "Aguard. comprador",
  awaiting_seller: "Aguard. vendedor",
  open: "Aberta",
  resolved: "Resolvida",
  closed: "Encerrada",
};

const STYLES: Record<AdminStatus, string> = {
  active: "bg-success/15 text-success border-success/30",
  approved: "bg-success/15 text-success border-success/30",
  paid: "bg-success/15 text-success border-success/30",
  completed: "bg-success/15 text-success border-success/30",
  delivered: "bg-primary/15 text-primary border-primary/30",
  resolved: "bg-success/15 text-success border-success/30",

  suspended: "bg-warning/15 text-warning border-warning/30",
  paused: "bg-warning/15 text-warning border-warning/30",
  in_review: "bg-warning/15 text-warning border-warning/30",
  pending: "bg-warning/15 text-warning border-warning/30",
  awaiting_payment: "bg-warning/15 text-warning border-warning/30",
  awaiting_buyer: "bg-warning/15 text-warning border-warning/30",
  awaiting_seller: "bg-warning/15 text-warning border-warning/30",
  open: "bg-warning/15 text-warning border-warning/30",

  blocked: "bg-destructive/15 text-destructive border-destructive/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  removed: "bg-destructive/15 text-destructive border-destructive/30",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
  in_dispute: "bg-destructive/15 text-destructive border-destructive/30",
  refunded: "bg-muted text-muted-foreground border-border",
  sold: "bg-muted text-muted-foreground border-border",
  closed: "bg-muted text-muted-foreground border-border",
};

export function AdminStatusBadge({ status, className }: { status: AdminStatus; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("gap-1 border text-[10px] font-medium", STYLES[status], className)}
    >
      {LABELS[status]}
    </Badge>
  );
}
