import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Minus, Plus, ShieldCheck, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/format";
import { useCart } from "@/providers/CartProvider";
import type { CartItem } from "@/types";

interface CartItemCardProps {
  item: CartItem;
}

export function CartItemCard({ item }: CartItemCardProps) {
  const { updateQuantity, removeItem } = useCart();

  const dec = () => {
    updateQuantity(item.key, item.quantity - 1);
    toast("Quantidade atualizada");
  };
  const inc = () => {
    updateQuantity(item.key, item.quantity + 1);
    toast("Quantidade atualizada");
  };
  const remove = () => {
    removeItem(item.key);
    toast.success("Item removido do carrinho");
  };

  const lineTotal = item.price * item.quantity;
  const variantLabel = item.selectedVariantTitle;
  const virtualUnit = item.virtualCurrencyUnit;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      className="flex gap-4 rounded-2xl border border-border bg-card p-3 shadow-card md:p-4"
    >
      <Link
        to="/produto/$id"
        params={{ id: item.slug }}
        className="relative block h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-surface md:h-28 md:w-28"
      >
        <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
      </Link>

      <div className="flex flex-1 flex-col gap-2 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
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
              className="mt-1 line-clamp-2 text-sm font-medium text-foreground hover:text-primary md:text-base"
            >
              {item.title}
            </Link>
            {variantLabel && (
              <div className="mt-1 text-xs text-primary">Variação: {variantLabel}</div>
            )}
            {virtualUnit && (
              <div className="mt-1 text-xs text-primary">
                {item.quantity.toLocaleString("pt-BR")} {virtualUnit}
              </div>
            )}
            <div className="mt-1 text-xs text-muted-foreground">
              Vendedor:{" "}
              {item.sellerSlug ? (
                <Link
                  to="/loja/$slug"
                  params={{ slug: item.sellerSlug }}
                  className="text-foreground hover:text-primary"
                >
                  {item.sellerName}
                </Link>
              ) : (
                <span className="text-foreground">{item.sellerName}</span>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Remover item"
            onClick={remove}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-3">
          {!virtualUnit && (
            <div className="inline-flex items-center rounded-lg border border-border">
              <button
                type="button"
                onClick={dec}
                aria-label="Diminuir"
                className="grid h-8 w-8 place-items-center text-muted-foreground hover:text-foreground"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
              <button
                type="button"
                onClick={inc}
                aria-label="Aumentar"
                className="grid h-8 w-8 place-items-center text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <div className="text-right ml-auto">
            {item.oldPrice && (
              <div className="text-[11px] text-muted-foreground line-through">
                {formatBRL(item.oldPrice * item.quantity)}
              </div>
            )}
            <div className="text-base font-bold text-foreground md:text-lg">
              {formatBRL(lineTotal)}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {virtualUnit
                ? `${item.quantity.toLocaleString("pt-BR")} ${virtualUnit}`
                : `${item.quantity} × ${formatBRL(item.price)}`}
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
