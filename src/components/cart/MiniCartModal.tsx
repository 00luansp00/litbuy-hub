import { Link, useNavigate } from "@tanstack/react-router";
import { ShoppingCart, ShoppingBag, X, Zap } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import type { MiniCartItem } from "@/types";

interface MiniCartModalProps {
  open: boolean;
  onClose: () => void;
  item: MiniCartItem | null;
  cartCount: number;
  cartSubtotal: number;
}

/**
 * MiniCartModal — modal de confirmação exibido após adicionar item ao carrinho.
 * Não substitui /carrinho nem /checkout — apenas melhora a UX de conversão.
 */
export function MiniCartModal({
  open,
  onClose,
  item,
  cartCount,
  cartSubtotal,
}: MiniCartModalProps) {
  const navigate = useNavigate();

  const goCart = () => {
    onClose();
    navigate({ to: "/carrinho" });
  };
  const goCheckout = () => {
    onClose();
    navigate({ to: "/checkout" });
  };

  return (
    <AnimatePresence>
      {open && item && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Item adicionado ao carrinho"
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="fixed inset-0 z-50 grid place-items-center p-4"
          >
            <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-elegant">
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-surface hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="border-b border-border bg-gradient-to-r from-success/10 to-primary/10 p-4 pr-12">
                <div className="flex items-center gap-2 text-sm font-semibold text-success">
                  <Zap className="h-4 w-4" /> Adicionado ao carrinho
                </div>
                <p className="text-xs text-muted-foreground">
                  Você pode continuar comprando ou finalizar agora.
                </p>
              </div>

              <div className="flex gap-3 p-4">
                <Link
                  to="/produto/$id"
                  params={{ id: item.slug }}
                  onClick={onClose}
                  className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-surface"
                >
                  <img
                    src={item.image}
                    alt={item.title}
                    className="h-full w-full object-cover"
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-sm font-medium text-foreground">
                    {item.title}
                  </div>
                  {item.variantTitle && (
                    <div className="mt-0.5 text-xs text-primary">
                      Variação: {item.variantTitle}
                    </div>
                  )}
                  {item.virtualCurrencyUnit && (
                    <div className="mt-0.5 text-xs text-primary">
                      {item.quantity.toLocaleString("pt-BR")}{" "}
                      {item.virtualCurrencyUnit}
                    </div>
                  )}
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {item.virtualCurrencyUnit
                        ? `Total`
                        : `${item.quantity} × ${formatBRL(item.unitPrice)}`}
                    </span>
                    <span className="text-base font-bold text-foreground">
                      {formatBRL(item.subtotal)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t border-border bg-surface/40 px-4 py-3 text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5">
                    <ShoppingBag className="h-3.5 w-3.5" />
                    {cartCount} {cartCount === 1 ? "item" : "itens"} no carrinho
                  </span>
                  <span className="font-semibold text-foreground">
                    {formatBRL(cartSubtotal)}
                  </span>
                </div>
              </div>

              <div className="grid gap-2 p-4 sm:grid-cols-3">
                <Button variant="outline" onClick={onClose}>
                  Continuar comprando
                </Button>
                <Button variant="secondary" onClick={goCart}>
                  <ShoppingCart className="mr-2 h-4 w-4" /> Ver carrinho
                </Button>
                <Button onClick={goCheckout}>Finalizar compra</Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
