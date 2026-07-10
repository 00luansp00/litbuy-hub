import { useState } from "react";
import { motion } from "motion/react";
import { BadgePercent, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCart } from "@/providers/CartProvider";

export function CartCouponBox() {
  const { coupon, applyCoupon, removeCoupon } = useCart();
  const [code, setCode] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    const res = applyCoupon(code);
    if (res.ok) toast.success(res.message);
    else toast.error(res.message);
    setCode("");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card p-4 shadow-card"
    >
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <BadgePercent className="h-4 w-4 text-primary" />
        Cupom de desconto
      </div>
      {coupon ? (
        <div className="flex items-center justify-between rounded-lg border border-success/40 bg-success/10 px-3 py-2">
          <div className="flex items-center gap-2 text-sm text-success">
            <Check className="h-4 w-4" />
            <span className="font-semibold">{coupon.code}</span>
            <span className="text-xs text-muted-foreground">— {coupon.label}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Remover cupom"
            onClick={() => {
              removeCoupon();
              toast("Cupom removido");
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Ex.: LIT10"
            aria-label="Código do cupom"
            className="bg-surface"
          />
          <Button type="submit" variant="secondary">
            Aplicar
          </Button>
        </form>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">
        Cupons válidos para testes:{" "}
        <span className="font-mono text-foreground">LIT10</span> ·{" "}
        <span className="font-mono text-foreground">PRIMEIRA</span>
      </p>
    </motion.div>
  );
}
