import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/types";

const META: Record<OrderStatus, { label: string; tone: string }> = {
  pending_payment: { label: "Aguardando pagamento", tone: "bg-warning/15 text-warning border-warning/30" },
  paid: { label: "Pago", tone: "bg-primary/15 text-primary border-primary/30" },
  awaiting_seller_delivery: {
    label: "Aguardando vendedor",
    tone: "bg-primary/15 text-primary border-primary/30",
  },
  delivered_by_seller: {
    label: "Entregue pelo vendedor",
    tone: "bg-accent/15 text-accent border-accent/30",
  },
  awaiting_buyer_confirmation: {
    label: "Aguardando sua confirmação",
    tone: "bg-warning/15 text-warning border-warning/30",
  },
  completed: { label: "Concluído", tone: "bg-success/15 text-success border-success/30" },
  cancelled: { label: "Cancelado", tone: "bg-destructive/15 text-destructive border-destructive/30" },
  disputed: { label: "Em disputa", tone: "bg-destructive/15 text-destructive border-destructive/30" },
  refunded: { label: "Reembolsado", tone: "bg-muted text-muted-foreground border-border" },
};

export function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const meta = META[status];
  return (
    <Badge variant="outline" className={cn("rounded-full font-medium", meta.tone, className)}>
      {meta.label}
    </Badge>
  );
}
