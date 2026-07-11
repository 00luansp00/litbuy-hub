import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { ArrowRight, PackagePlus, ShoppingBag, Star, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const actions = [
  {
    label: "Criar anúncio",
    description: "Publique um novo produto em minutos.",
    icon: PackagePlus,
    to: "/vendedor/anuncios/novo" as const,
    tone: "bg-primary/10 text-primary",
  },
  {
    label: "Ver vendas",
    description: "Acompanhe pedidos e entregas.",
    icon: ShoppingBag,
    to: "/vendedor/vendas" as const,
    tone: "bg-accent/10 text-accent",
  },
  {
    label: "Financeiro",
    description: "Saldo, taxas e histórico.",
    icon: Wallet,
    to: "/vendedor/financeiro" as const,
    tone: "bg-success/10 text-success",
  },
  {
    label: "Avaliações",
    description: "Responda seus compradores.",
    icon: Star,
    to: "/vendedor/avaliacoes" as const,
    tone: "bg-warning/10 text-warning",
  },
];

export function SellerQuickActions() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl border border-border bg-card p-5 shadow-card"
    >
      <header className="mb-4">
        <h3 className="text-lg font-bold text-foreground">Atalhos rápidos</h3>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        {actions.map((a) => (
          <Link
            key={a.label}
            to={a.to}
            className="group flex items-center gap-3 rounded-xl border border-border bg-surface/40 p-3 transition-colors hover:border-primary/40 hover:bg-surface"
          >
            <span className={cn("grid h-10 w-10 place-items-center rounded-lg", a.tone)}>
              <a.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-foreground">{a.label}</div>
              <div className="text-xs text-muted-foreground">{a.description}</div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
    </motion.section>
  );
}
