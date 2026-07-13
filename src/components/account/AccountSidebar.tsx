import { Link, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Bell,
  Heart,
  LayoutDashboard,
  MessageSquare,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type AccountRoute =
  | "/perfil"
  | "/pedidos"
  | "/favoritos"
  | "/mensagens"
  | "/carteira"
  | "/perfil/verificacao"
  | "/afiliados"
  | "/vendedor";

interface AccountNavItem {
  label: string;
  icon: LucideIcon;
  to?: AccountRoute;
  /** Quando definido, o item ainda não tem rota — só emite feedback. */
  soon?: boolean;
  soonMessage?: string;
  /** Destaque discreto (CTA "Vender na LIT Buy"). */
  cta?: boolean;
}

const items: AccountNavItem[] = [
  { label: "Visão geral", icon: LayoutDashboard, to: "/perfil" },
  { label: "Meus pedidos", icon: ShoppingBag, to: "/pedidos" },
  { label: "Favoritos", icon: Heart, to: "/favoritos" },
  { label: "Mensagens", icon: MessageSquare, to: "/mensagens" },
  { label: "Carteira", icon: Wallet, to: "/carteira" },
  { label: "Verificação", icon: ShieldCheck, to: "/perfil/verificacao" },
  { label: "Afiliados", icon: Users, to: "/afiliados" },
  {
    label: "Segurança",
    icon: ShieldCheck,
    soon: true,
    soonMessage: "A área de segurança será liberada em uma próxima sprint.",
  },
  {
    label: "Configurações",
    icon: Settings,
    soon: true,
    soonMessage: "As configurações serão liberadas em uma próxima sprint.",
  },
  { label: "Vender na LIT Buy", icon: Store, to: "/vendedor", cta: true },
];

interface AccountSidebarProps {
  className?: string;
  /** "vertical" = desktop; "horizontal" = mobile (scrollável). */
  orientation?: "vertical" | "horizontal";
}

/**
 * AccountSidebar — menu de navegação da área do usuário.
 * Em desktop é vertical; em mobile é uma barra horizontal scrollável.
 */
export function AccountSidebar({
  className,
  orientation = "vertical",
}: AccountSidebarProps) {
  const currentPath = useRouterState({
    select: (r) => r.location.pathname,
  });

  const isHorizontal = orientation === "horizontal";

  return (
    <nav
      aria-label="Navegação da conta"
      className={cn(
        isHorizontal
          ? "-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          : "flex flex-col gap-1 rounded-2xl border border-border bg-card p-3 shadow-card",
        className,
      )}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.to === currentPath;

        const baseClass = cn(
          "group inline-flex items-center gap-2.5 rounded-lg text-sm font-medium transition-colors",
          isHorizontal
            ? "shrink-0 border border-border px-3 py-2"
            : "w-full px-3 py-2.5",
          active
            ? isHorizontal
              ? "border-primary/50 bg-primary/10 text-primary"
              : "bg-primary/10 text-primary"
            : item.cta
              ? "text-primary hover:bg-primary/10"
              : "text-muted-foreground hover:bg-surface hover:text-foreground",
          item.cta && !isHorizontal && "mt-2 border border-dashed border-primary/40",
        );

        if (item.soon) {
          return (
            <button
              key={item.label}
              type="button"
              className={baseClass}
              onClick={() =>
                toast("Em breve", {
                  description: item.soonMessage,
                })
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">{item.label}</span>
            </button>
          );
        }

        return (
          <Link
            key={item.label}
            to={item.to!}
            className={baseClass}
            activeProps={{ className: "text-primary" }}
          >
            <Icon
              className={cn(
                "h-4 w-4 shrink-0",
                active
                  ? "text-primary"
                  : item.cta
                    ? "text-primary"
                    : "text-muted-foreground group-hover:text-foreground",
              )}
            />
            <span className="whitespace-nowrap">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
