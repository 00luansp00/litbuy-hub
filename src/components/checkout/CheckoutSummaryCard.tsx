import { motion } from "motion/react";
import { CheckCircle2, Loader2, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatBRL } from "@/lib/format";
import type { CartCoupon, CartItem, CheckoutSummary, PaymentMethod } from "@/types";

interface CheckoutSummaryCardProps {
  summary: CheckoutSummary;
  items: CartItem[];
  coupon: CartCoupon | null;
  paymentMethod?: PaymentMethod;
  onConfirm: () => void;
  loading?: boolean;
}

export function CheckoutSummaryCard({
  summary,
  items,
  coupon,
  paymentMethod,
  onConfirm,
  loading,
}: CheckoutSummaryCardProps) {
  const hasInstant = items.some((i) => i.instantDelivery);
  const canFinalize = !!paymentMethod && summary.itemCount > 0 && !loading;

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
          {summary.itemCount} {summary.itemCount === 1 ? "item" : "itens"} para finalizar
        </p>
      </div>

      <div className="space-y-2 text-sm">
        <Row label="Subtotal" value={formatBRL(summary.subtotal)} />
        {summary.discount > 0 && (
          <Row
            label={coupon ? `Desconto (${coupon.code})` : "Desconto"}
            value={`- ${formatBRL(summary.discount)}`}
            tone="success"
          />
        )}
        {summary.platformFee > 0 && (
          <Row label="Taxa da plataforma" value={formatBRL(summary.platformFee)} />
        )}
      </div>

      <Separator />

      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted-foreground">Total</span>
        <span className="text-2xl font-bold text-foreground">
          {formatBRL(summary.total)}
        </span>
      </div>

      <div className="rounded-lg border border-dashed border-border bg-surface/60 px-3 py-2 text-xs">
        <span className="text-muted-foreground">Pagamento: </span>
        <span className="font-medium text-foreground">
          {paymentMethod?.label ?? "Selecione um método"}
        </span>
      </div>

      <Button size="lg" onClick={onConfirm} disabled={!canFinalize}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...
          </>
        ) : (
          <>
            <CheckCircle2 className="mr-2 h-4 w-4" /> Finalizar pedido
          </>
        )}
      </Button>

      <ul className="space-y-2 text-xs text-muted-foreground">
        <li className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          Pagamento protegido pela LIT Buy
        </li>
        {hasInstant && (
          <li className="flex items-start gap-2">
            <Zap className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            Alguns itens têm entrega instantânea
          </li>
        )}
        <li className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          Nenhuma cobrança real é feita nesta demonstração
        </li>
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
      <span
        className={
          tone === "success" ? "font-medium text-success" : "font-medium text-foreground"
        }
      >
        {value}
      </span>
    </div>
  );
}
