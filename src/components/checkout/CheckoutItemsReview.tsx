import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { ArrowLeft, ShieldCheck, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import type { CartItem } from "@/types";

interface CheckoutItemsReviewProps {
  items: CartItem[];
}

export function CheckoutItemsReview({ items }: CheckoutItemsReviewProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl border border-border bg-card p-5 shadow-card"
    >
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Revisão dos itens</h2>
          <p className="text-xs text-muted-foreground">
            {items.length} {items.length === 1 ? "item" : "itens"} no pedido
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/carrinho">
            <ArrowLeft className="mr-2 h-4 w-4" /> Editar carrinho
          </Link>
        </Button>
      </header>

      <ul className="divide-y divide-border">
        {items.map((item) => (
          <li key={item.productId} className="flex gap-3 py-3 first:pt-0 last:pb-0">
            <Link
              to="/produto/$id"
              params={{ id: item.slug }}
              className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-surface"
            >
              <img
                src={item.image}
                alt={item.title}
                className="h-full w-full object-cover"
              />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="truncate">{item.category}</span>
                {item.instantDelivery && (
                  <Badge variant="secondary" className="gap-1 text-[10px]">
                    <Zap className="h-3 w-3" /> Instantâneo
                  </Badge>
                )}
                {item.verifiedSeller && (
                  <Badge variant="secondary" className="gap-1 text-[10px]">
                    <ShieldCheck className="h-3 w-3" /> Verificado
                  </Badge>
                )}
              </div>
              <Link
                to="/produto/$id"
                params={{ id: item.slug }}
                className="mt-0.5 line-clamp-2 text-sm font-medium text-foreground hover:text-primary"
              >
                {item.title}
              </Link>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                Vendedor: <span className="text-foreground">{item.sellerName}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-foreground">
                {formatBRL(item.price * item.quantity)}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {item.quantity} × {formatBRL(item.price)}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </motion.section>
  );
}
