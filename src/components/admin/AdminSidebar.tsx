import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeft,
  Flag,
  Gavel,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  ShoppingBag,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminNavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  cta?: boolean;
}

interface AdminSidebarProps {
  orientation?: "vertical" | "horizontal";
  className?: string;
}

const ITEMS: AdminNavItem[] = [
  { label: "Visão geral", to: "/admin", icon: LayoutDashboard },
  { label: "Usuários", to: "/admin/usuarios", icon: Users },
  { label: "Vendedores", to: "/admin/vendedores", icon: Store },
  { label: "Anúncios", to: "/admin/anuncios", icon: Package },
  { label: "Pedidos", to: "/admin/pedidos", icon: ShoppingBag },
  { label: "Transações", to: "/admin/transacoes", icon: Receipt },
  { label: "Disputas", to: "/admin/disputas", icon: Gavel },
  { label: "Denúncias", to: "/admin/denuncias", icon: Flag },
  { label: "Configurações", to: "/admin/configuracoes", icon: Settings },
  { label: "Voltar ao marketplace", to: "/", icon: ArrowLeft, cta: true },
];

export function AdminSidebar({ orientation = "vertical", className }: AdminSidebarProps) {
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const isHorizontal = orientation === "horizontal";

  return (
    <nav
      aria-label="Navegação administrativa"
      className={cn(
        isHorizontal
          ? "-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          : "flex flex-col gap-1 rounded-2xl border border-border bg-card p-3 shadow-card",
        className,
      )}
    >
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const active =
          !item.cta &&
          (item.to === "/admin"
            ? currentPath === "/admin"
            : currentPath.startsWith(item.to));

        return (
          <Link
            key={item.to}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            to={item.to as any}
            className={cn(
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
            )}
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
