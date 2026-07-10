import { Link } from "@tanstack/react-router";
import { Heart, MessageSquare, ShoppingBag, Wallet, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickAction {
  label: string;
  description: string;
  to: "/pedidos" | "/favoritos" | "/mensagens" | "/carteira";
  icon: typeof Heart;
}

const actions: QuickAction[] = [
  {
    label: "Meus pedidos",
    description: "Acompanhe suas compras.",
    to: "/pedidos",
    icon: ShoppingBag,
  },
  {
    label: "Favoritos",
    description: "Itens salvos para depois.",
    to: "/favoritos",
    icon: Heart,
  },
  {
    label: "Mensagens",
    description: "Fale com vendedores.",
    to: "/mensagens",
    icon: MessageSquare,
  },
  {
    label: "Carteira",
    description: "Saldo e transações.",
    to: "/carteira",
    icon: Wallet,
  },
];

interface QuickActionsCardProps {
  className?: string;
}

export function QuickActionsCard({ className }: QuickActionsCardProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card p-5 shadow-card md:p-6",
        className,
      )}
      aria-label="Atalhos rápidos"
    >
      <header className="mb-4 flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent/12 text-accent">
          <Zap className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Atalhos rápidos
          </h3>
          <p className="text-xs text-muted-foreground">
            Vá direto para o que você mais usa.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.to}
              to={a.to}
              className="group flex items-start gap-3 rounded-xl border border-border bg-surface/40 p-3 transition-colors hover:border-primary/40 hover:bg-surface"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-105">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {a.label}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {a.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
