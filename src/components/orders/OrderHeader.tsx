import { OrderStatusBadge } from "./OrderStatusBadge";
import { formatBRL } from "@/lib/format";
import type { Order } from "@/types";

export function OrderHeader({ order }: { order: Order }) {
  const created = new Date(order.createdAt).toLocaleString("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
  });
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
