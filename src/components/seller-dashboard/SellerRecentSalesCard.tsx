import { motion } from "motion/react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SellerSalePreview, SellerSaleStatus } from "@/types";


const STATUS_LABEL: Record<SellerSaleStatus, string> = {
  pending: "Aguardando",
  paid: "Pago",
  delivered: "Entregue",
  completed: "Concluído",
  refunded: "Estornado",
  cancelled: "Cancelado",
};

const STATUS_TONE: Record<SellerSaleStatus, string> = {
  pending: "bg-warning/15 text-warning border-warning/30",
  paid: "bg-primary/15 text-primary border-primary/30",
  delivered: "bg-success/15 text-success border-success/30",
  completed: "bg-success/15 text-success border-success/30",
  refunded: "bg-destructive/15 text-destructive border-destructive/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

interface SellerRecentSalesCardProps {
  sales: SellerSalePreview[];
  title?: string;
  compact?: boolean;
}

export function SellerRecentSalesCard({
  sales,
  title = "Vendas recentes",
  compact,
}: SellerRecentSalesCardProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl border border-border bg-card p-5 shadow-card"
    >
      <header className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground">{title}</h3>
      </header>

      {sales.length === 0 ? (
        <EmptyState
          icon="ShoppingBag"
          title="Nenhuma venda ainda"
          description="Publique seus primeiros anúncios para começar a vender."
        />
      ) : (
        <ul className="divide-y divide-border">
          {sales.map((s) => {
            const initials = s.buyerName
              .split(" ")
              .map((p) => p[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();
            return (
              <li key={s.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-surface">
                  <img
                    src={s.productImage}
                    alt={s.productTitle}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span>#{s.code}</span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-1.5 py-px text-[10px] font-medium",
                        STATUS_TONE[s.status],
                      )}
                    >
                      {STATUS_LABEL[s.status]}
                    </span>
                  </div>
                  <div className="mt-0.5 line-clamp-1 text-sm font-medium text-foreground">
                    {s.productTitle}
                  </div>
                  {!compact && (
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Avatar className="h-4 w-4">
                        <AvatarImage src={s.buyerAvatar} alt={s.buyerName} />
                        <AvatarFallback className="text-[8px]">{initials}</AvatarFallback>
                      </Avatar>
                      <span>{s.buyerName}</span>
                      <span>·</span>
                      <span>{new Date(s.createdAt).toLocaleDateString("pt-BR")}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-sm font-bold text-foreground">
                    {formatBRL(s.amount)}
                  </span>
                  {!compact && (
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                    >
                      <Link to="/vendedor/vendas/$id" params={{ id: s.id }}>
                        Detalhes <ArrowRight className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>

                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 flex items-center justify-end text-xs">
        <Badge variant="secondary" className="text-[10px]">
          Modo demonstração
        </Badge>
      </div>
    </motion.section>
  );
}
