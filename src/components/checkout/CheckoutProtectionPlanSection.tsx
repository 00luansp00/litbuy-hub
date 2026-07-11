import { motion } from "motion/react";
import { ShieldCheck, Sparkles, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { CheckoutProtectionPlan, CheckoutProtectionPlanId } from "@/types";

interface CheckoutProtectionPlanSectionProps {
  plans: CheckoutProtectionPlan[];
  selected: CheckoutProtectionPlanId;
  onSelect: (id: CheckoutProtectionPlanId) => void;
  highlightAccount?: boolean;
}

export function CheckoutProtectionPlanSection({
  plans,
  selected,
  onSelect,
  highlightAccount,
}: CheckoutProtectionPlanSectionProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.05 }}
      className="rounded-2xl border border-border bg-card p-5 shadow-card"
    >
      <header className="mb-4">
        <h2 className="text-lg font-bold text-foreground">
          Proteção do pedido
        </h2>
        <p className="text-xs text-muted-foreground">
          Escolha o nível de proteção para esta compra. Cobertura demonstrativa —
          regras finais dependem de política e antifraude no backend real.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {plans.map((plan) => {
          const isSel = selected === plan.id;
          const isPremium = plan.id === "lit_protection";
          return (
            <button
              key={plan.id}
              type="button"
              aria-pressed={isSel}
              onClick={() => onSelect(plan.id)}
              className={cn(
                "group flex flex-col gap-2 rounded-xl border p-4 text-left transition-all",
                "border-border bg-surface/40 hover:border-primary/40 hover:bg-surface",
                isSel && "border-primary bg-primary/5 shadow-elegant",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {isPremium ? (
                    <Sparkles className="h-4 w-4 text-accent" />
                  ) : (
                    <ShieldCheck className="h-4 w-4 text-success" />
                  )}
                  <span className="text-sm font-semibold text-foreground">
                    {plan.name}
                  </span>
                </div>
                {isPremium ? (
                  <Badge variant="secondary" className="text-[10px]">
                    +15%
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">
                    Incluída
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{plan.tagline}</p>
              <ul className="mt-1 space-y-1 text-[11px] text-muted-foreground">
                {plan.benefits.map((b) => (
                  <li key={b} className="flex items-start gap-1.5">
                    <Check className="mt-0.5 h-3 w-3 shrink-0 text-success" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              {isPremium && highlightAccount && (
                <div className="mt-1 rounded-md border border-accent/30 bg-accent/10 px-2 py-1 text-[11px] text-accent">
                  Recomendado — há produto tipo Conta no carrinho.
                </div>
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        Cobertura demonstrativa. Nenhum seguro ou garantia real é emitido nesta versão.
      </p>
    </motion.section>
  );
}
