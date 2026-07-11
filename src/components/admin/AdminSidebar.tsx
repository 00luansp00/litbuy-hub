import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeft,
  BarChart3,
  ClipboardList,
  FileText,
  Flag,
  Gavel,
  LayoutDashboard,
  Layers,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminNavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  cta?: boolean;
}

interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

interface AdminSidebarProps {
  orientation?: "vertical" | "horizontal";
  className?: string;
}

const GROUPS: AdminNavGroup[] = [
  {
    label: "Operação",
    items: [
      { label: "Visão geral", to: "/admin", icon: LayoutDashboard },
      { label: "Anúncios", to: "/admin/anuncios", icon: Package },
      { label: "Pedidos", to: "/admin/pedidos", icon: ShoppingBag },
      { label: "Transações", to: "/admin/transacoes", icon: Receipt },
      { label: "Disputas", to: "/admin/disputas", icon: Gavel },
      { label: "Denúncias", to: "/admin/denuncias", icon: Flag },
      { label: "Verificações", to: "/admin/verificacoes", icon: ShieldCheck },
    ],
  },
  {
    label: "Pessoas",
    items: [
      { label: "Usuários", to: "/admin/usuarios", icon: Users },
      { label: "Vendedores", to: "/admin/vendedores", icon: Store },
      { label: "Permissões", to: "/admin/permissoes", icon: UserCog },
    ],
  },
  {
    label: "Plataforma",
    items: [
      { label: "Catálogo", to: "/admin/catalogo", icon: Layers },
      { label: "Financeiro", to: "/admin/financeiro", icon: Wallet },
      { label: "Conteúdo", to: "/admin/conteudo", icon: FileText },
      { label: "Relatórios", to: "/admin/relatorios", icon: BarChart3 },
      { label: "Auditoria", to: "/admin/auditoria", icon: ClipboardList },
      { label: "Configurações", to: "/admin/configuracoes", icon: Settings },
    ],
  },
];

const BACK: AdminNavItem = { label: "Voltar ao marketplace", to: "/", icon: ArrowLeft, cta: true };

export function AdminSidebar({ orientation = "vertical", className }: AdminSidebarProps) {
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const isHorizontal = orientation === "horizontal";

  const renderItem = (item: AdminNavItem) => {
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
          isHorizontal ? "shrink-0 border border-border px-3 py-2" : "w-full px-3 py-2.5",
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
            active ? "text-primary" : item.cta ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
          )}
        />
        <span className="whitespace-nowrap">{item.label}</span>
      </Link>
    );
  };

  if (isHorizontal) {
    return (
      <nav
        aria-label="Navegação administrativa"
        className={cn(
          "-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          className,
        )}
      >
        {GROUPS.flatMap((g) => g.items).map(renderItem)}
        {renderItem(BACK)}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Navegação administrativa"
      className={cn("flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 shadow-card", className)}
    >
      {GROUPS.map((g) => (
        <div key={g.label} className="flex flex-col gap-1">
          <div className="px-3 pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
            {g.label}
          </div>
          {g.items.map(renderItem)}
        </div>
      ))}
      {renderItem(BACK)}
    </nav>
  );
}
