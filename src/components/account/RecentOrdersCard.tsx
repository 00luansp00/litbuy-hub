import { Link } from "@tanstack/react-router";


import { ArrowRight, PackageCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { UserOrderPreview, UserOrderStatus } from "@/types";

interface RecentOrdersCardProps {
  orders: UserOrderPreview[];
  loading?: boolean;
  className?: string;
  /** Quando `true`, esconde o header (útil dentro da própria página /pedidos). */
  hideHeader?: boolean;
}

const STATUS_META: Record<
  UserOrderStatus,
  { label: string; tone: string }
> = {
  pending: { label: "Aguardando pagamento", tone: "bg-warning/15 text-warning" },
  processing: { label: "Processando", tone: "bg-primary/15 text-primary" },
  delivered: { label: "Entregue", tone: "bg-accent/15 text-accent" },
  completed: { label: "Concluído", tone: "bg-success/15 text-success" },
  cancelled: { label: "Cancelado", tone: "bg-destructive/15 text-destructive" },
  refunded: { label: "Reembolsado", tone: "bg-muted text-muted-foreground" },
};

export function RecentOrdersCard({
  orders,
  loading = false,
  className,
  hideHeader,
}: RecentOrdersCardProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card p-5 shadow-card md:p-6",
        className,
      )}
      aria-label="Pedidos recentes"
    >
      {!hideHeader && (
        <header className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Pedidos recentes
            </h3>
            <p className="text-xs text-muted-foreground">
              Últimas compras realizadas por você.
            </p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/pedidos">
              Ver todos <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </header>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon="ShoppingBag"
          title="Nenhum pedido ainda"
          description="Quando você fizer sua primeira compra ela aparecerá aqui."
          action={{ label: "Explorar produtos", to: "/" }}
        />
      ) : (
        <ul className="divide-y divide-border">
          {orders.map((order) => {
            const meta = STATUS_META[order.status];
            return (
              <li
                key={order.id}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <img
                  src={order.productImage}
                  alt=""
                  aria-hidden
                  className="h-12 w-12 shrink-0 rounded-lg border border-border object-cover"
                  loading="lazy"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {order.productTitle}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/80">
                      {order.code}
                    </span>
                    <span>•</span>
                    <span>{order.sellerName}</span>
                    <span>•</span>
                    <span>
                      {new Date(order.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </div>
                <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                  <Badge className={cn("rounded-full font-medium", meta.tone)} variant="outline">
                    <PackageCheck className="h-3 w-3" /> {meta.label}
                  </Badge>
                  <span className="text-sm font-semibold text-foreground">
                    {formatBRL(order.total)}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="shrink-0"
                  asChild
                >
                  <Link to="/pedidos/$id" params={{ id: order.id }}>
                    Ver detalhes
                  </Link>
                </Button>

              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
