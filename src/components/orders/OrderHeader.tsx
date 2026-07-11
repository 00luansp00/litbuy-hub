import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { formatBRL } from "@/lib/format";
import type { Order } from "@/types";

export function OrderHeader({ order }: { order: Order }) {
  const created = new Date(order.createdAt).toLocaleString("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
  });
  const litProtection = order.litProtection;
  const daysLeft = litProtection
    ? Math.max(
        0,
        Math.ceil(
          (new Date(litProtection.expiresAt).getTime() - Date.now()) /
            (24 * 3600_000),
        ),
      )
    : 0;
  return (
    <header className="rounded-2xl border border-border bg-card p-5 shadow-card md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Pedido
          </p>
          <h1 className="truncate text-2xl font-bold text-foreground">
            {order.code}
          </h1>
          <p className="text-xs text-muted-foreground">Criado em {created}</p>
          {litProtection?.active && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge className="inline-flex items-center gap-1 border border-accent/40 bg-accent/10 text-accent">
                <ShieldCheck className="h-3 w-3" />
                Proteção LIT ativa
              </Badge>
              <span className="text-[11px] text-muted-foreground">
                Garantia demonstrativa · {daysLeft} dias restantes
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <OrderStatusBadge status={order.status} />
          <span className="text-lg font-semibold text-foreground">
            {formatBRL(order.total)}
          </span>
          <span className="text-[11px] text-muted-foreground">
            Pagamento: {order.paymentMethod}
          </span>
        </div>
      </div>
    </header>
  );
}
