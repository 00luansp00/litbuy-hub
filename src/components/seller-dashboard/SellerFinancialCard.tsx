import { motion } from "motion/react";
import { toast } from "sonner";
import { ArrowDownToLine, TrendingUp, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatBRL } from "@/lib/format";
import type { SellerFinancialSummary } from "@/types";

interface SellerFinancialCardProps {
  financial: SellerFinancialSummary;
  compact?: boolean;
}

export function SellerFinancialCard({ financial, compact }: SellerFinancialCardProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl border border-border bg-card p-5 shadow-card"
    >
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-foreground">Financeiro</h3>
          <p className="text-xs text-muted-foreground">
            Dados de demonstração — nenhum valor real.
          </p>
        </div>
        <Badge variant="secondary" className="gap-1">
          <Wallet className="h-3 w-3" /> Demo
        </Badge>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <MoneyBox
          label="Saldo disponível"
          value={formatBRL(financial.available)}
          tone="text-success"
        />
        <MoneyBox
          label="Saldo a liberar"
          value={formatBRL(financial.pending)}
          tone="text-warning"
        />
        {!compact && (
          <>
            <MoneyBox
              label="Total vendido"
              value={formatBRL(financial.totalSold)}
              tone="text-foreground"
            />
            <MoneyBox
              label="Taxas mockadas"
              value={formatBRL(financial.totalFees)}
              tone="text-muted-foreground"
            />
          </>
        )}
      </div>

      <Separator className="my-5" />

      <Button
        className="w-full"
        onClick={() =>
          toast("Em breve", {
            description:
              "Saques serão liberados após integração real da carteira LIT.",
          })
        }
      >
        <ArrowDownToLine className="mr-2 h-4 w-4" /> Solicitar saque
      </Button>

      <div className="mt-3 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <TrendingUp className="h-3 w-3" />
        Valores fictícios para preview.
      </div>
    </motion.section>
  );
}

function MoneyBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface/60 p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`mt-0.5 text-lg font-bold ${tone}`}>{value}</div>
    </div>
  );
}
