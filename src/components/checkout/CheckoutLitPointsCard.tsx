import { motion } from "motion/react";
import { Sparkles, Coins } from "lucide-react";
import type { LitPointsCheckoutPreview } from "@/types";

interface CheckoutLitPointsCardProps {
  preview: LitPointsCheckoutPreview;
  protectionEnabled: boolean;
}

export function CheckoutLitPointsCard({
  preview,
  protectionEnabled,
}: CheckoutLitPointsCardProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.08 }}
      className="rounded-2xl border border-border bg-card p-5 shadow-card"
    >
      <header className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-accent" />
        <h2 className="text-lg font-bold text-foreground">LIT Points</h2>
      </header>

      <ul className="space-y-2 text-sm">
        <li className="flex items-center justify-between">
          <span className="text-muted-foreground">Você ganhará nesta compra</span>
          <span className="font-semibold text-foreground">
            +{preview.earned.toLocaleString("pt-BR")}
          </span>
        </li>
        {protectionEnabled && preview.bonusFromProtection > 0 && (
          <li className="flex items-center justify-between text-xs text-accent">
            <span>Bônus com Proteção LIT</span>
            <span>+{preview.bonusFromProtection.toLocaleString("pt-BR")}</span>
          </li>
        )}
        <li className="flex items-center justify-between">
          <span className="text-muted-foreground">Saldo atual (mock)</span>
          <span className="inline-flex items-center gap-1 font-medium text-foreground">
            <Coins className="h-3.5 w-3.5 text-accent" />
            {preview.balance.toLocaleString("pt-BR")}
          </span>
        </li>
      </ul>

      <p className="mt-3 text-[11px] text-muted-foreground">
        LIT Points são visuais nesta versão. Uso real como método de pagamento
        depende das regras finais definidas no backend.
      </p>
    </motion.section>
  );
}
