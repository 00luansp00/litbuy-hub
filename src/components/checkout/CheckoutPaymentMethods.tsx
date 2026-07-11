import { motion } from "motion/react";
import { icons, CreditCard, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { PaymentMethod, PaymentMethodId } from "@/types";

interface CheckoutPaymentMethodsProps {
  methods: PaymentMethod[];
  selected?: PaymentMethodId;
  onSelect: (id: PaymentMethodId) => void;
}

export function CheckoutPaymentMethods({
  methods,
  selected,
  onSelect,
}: CheckoutPaymentMethodsProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1 }}
      className="rounded-2xl border border-border bg-card p-5 shadow-card"
    >
      <header className="mb-4">
        <h2 className="text-lg font-bold text-foreground">Método de pagamento</h2>
        <p className="text-xs text-muted-foreground">
          Nenhum dado sensível é solicitado nesta demonstração.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {methods.map((method) => {
          const Icon =
            (icons as Record<string, React.ComponentType<{ className?: string }>>)[
              method.icon
            ] ?? CreditCard;
          const isSelected = selected === method.id;
          return (
            <button
              key={method.id}
              type="button"
              disabled={method.disabled}
              onClick={() => !method.disabled && onSelect(method.id)}
              aria-pressed={isSelected}
              className={cn(
                "group relative flex items-start gap-3 rounded-xl border p-4 text-left transition-all",
                "border-border bg-surface/40 hover:border-primary/40 hover:bg-surface",
                isSelected && "border-primary bg-primary/5 shadow-elegant",
                method.disabled && "cursor-not-allowed opacity-60 hover:border-border hover:bg-surface/40",
              )}
            >
              <span
                className={cn(
                  "grid h-10 w-10 shrink-0 place-items-center rounded-lg transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {method.label}
                  </span>
                  {method.tag && (
                    <Badge variant="secondary" className="text-[10px]">
                      {method.tag}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {method.description}
                </p>
              </div>
              {isSelected && (
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </motion.section>
  );
}
