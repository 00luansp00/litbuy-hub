import { motion } from "motion/react";
import { BadgeCheck, Mail, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { BuyerProfile } from "@/types";

interface CheckoutBuyerCardProps {
  buyer: BuyerProfile;
}

export function CheckoutBuyerCard({ buyer }: CheckoutBuyerCardProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.05 }}
      className="rounded-2xl border border-border bg-card p-5 shadow-card"
    >
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Dados do comprador</h2>
          <p className="text-xs text-muted-foreground">
            Informações usadas apenas para exibição nesta demonstração.
          </p>
        </div>
        {buyer.verified && (
          <Badge variant="secondary" className="gap-1">
            <BadgeCheck className="h-3.5 w-3.5 text-success" /> Verificado
          </Badge>
        )}
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field icon={User} label="Nome" value={buyer.name} />
        <Field icon={Mail} label="Email" value={buyer.email} />
      </div>

      <div className="mt-4 rounded-lg border border-dashed border-border bg-surface/60 px-3 py-2 text-xs text-muted-foreground">
        Status: <span className="font-medium text-foreground">{buyer.status}</span>
      </div>
    </motion.section>
  );
}

function Field({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-surface/60 p-3">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-card text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="truncate text-sm font-medium text-foreground">{value}</div>
      </div>
    </div>
  );
}
