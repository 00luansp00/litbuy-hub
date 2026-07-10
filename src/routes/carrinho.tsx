import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CartItemCard } from "@/components/cart/CartItemCard";
import { CartSummaryCard } from "@/components/cart/CartSummaryCard";
import { CartCouponBox } from "@/components/cart/CartCouponBox";
import { EmptyCartState } from "@/components/cart/EmptyCartState";
import { CartSecurityNotice } from "@/components/cart/CartSecurityNotice";
import { useCart } from "@/providers/CartProvider";

export const Route = createFileRoute("/carrinho")({
  component: CarrinhoPage,
});

function CarrinhoPage() {
  const { items, itemCount, clearCart } = useCart();

  return (
    <div className="container-lit space-y-8 py-6 md:py-10">
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Meu carrinho
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Revise seus itens antes de finalizar a compra. Nada é cobrado agora.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" /> Continuar comprando
            </Link>
          </Button>
          {items.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                clearCart();
                toast.success("Carrinho limpo");
              }}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Limpar
            </Button>
          )}
        </div>
      </motion.header>

      {items.length === 0 ? (
        <EmptyCartState />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {itemCount} {itemCount === 1 ? "item" : "itens"} no carrinho
              </span>
            </div>
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {items.map((item) => (
                  <CartItemCard key={item.productId} item={item} />
                ))}
              </AnimatePresence>
            </div>
            <CartSecurityNotice />
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <CartCouponBox />
            <CartSummaryCard />
          </aside>
        </div>
      )}
    </div>
  );
}
