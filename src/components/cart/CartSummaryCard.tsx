import { motion } from "motion/react";
import { useNavigate } from "@tanstack/react-router";
import { ShieldCheck, ShoppingBag, Wallet, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatBRL } from "@/lib/format";
import { useCart } from "@/providers/CartProvider";

export function CartSummaryCard() {
  const { itemCount, subtotal, discount, platformFee, total, items } = useCart();
  const navigate = useNavigate();

  const goCheckout = () => {
    if (items.length === 0) {
      toast.error("Adicione produtos ao carrinho antes de continuar.");
      return;
    }
    navigate({ to: "/checkout" });
  };

  const hasInstant = items.some((i) => i.instantDelivery);

  return (
    <motion.aside
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-card"
    >
      <div>
        <h3 className="text-lg font-bold text-foreground">Resumo do pedido</h3>
        <p className="text-xs text-muted-foreground">
          {itemCount} {itemCount === 1 ? "item" : "itens"} no carrinho
        </p>
      </div>

      <div className="space-y-2 text-sm">
        <Row label="Subtotal" value={formatBRL(subtotal)} />
        {discount > 0 && (
          <Row label="Desconto" value={`- ${formatBRL(discount)}`} tone="success" />
        )}
        {platformFee > 0 && (
          <Row label="Taxa da plataforma" value={formatBRL(platformFee)} />
        )}
      </div>

      <Separator />

      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted-foreground">Total</span>
        <span className="text-2xl font-bold text-foreground">{formatBRL(total)}</span>
      </div>

      <Button size="lg" onClick={goCheckout}>
        <ShoppingBag className="mr-2 h-4 w-4" /> Ir para checkout
      </Button>

      <ul className="space-y-2 text-xs text-muted-foreground">
        <li className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          Pagamento 100% protegido pela LIT Buy
        </li>
        <li className="flex items-start gap-2">
          <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          Reembolso garantido em caso de problemas
        </li>
        {hasInstant && (
          <li className="flex items-start gap-2">
            <Zap className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            Alguns itens possuem entrega instantânea
          </li>
        )}
      </ul>
    </motion.aside>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success";
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={tone === "success" ? "font-medium text-success" : "font-medium text-foreground"}>
        {value}
      </span>
    </div>
  );
}
