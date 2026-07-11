import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  BarChart3,
  ExternalLink,
  LayoutDashboard,
  PackagePlus,
  Package,
  ShoppingBag,
  Star,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SellerNavItem {
  label: string;
  icon: LucideIcon;
  to: string;
  params?: Record<string, string>;
  external?: boolean;
  cta?: boolean;
}

interface SellerDashboardSidebarProps {
  publicSlug?: string;
  orientation?: "vertical" | "horizontal";
  className?: string;
}

export function SellerDashboardSidebar({
  publicSlug,
  orientation = "vertical",
  className,
}: SellerDashboardSidebarProps) {
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const isHorizontal = orientation === "horizontal";

  const items: SellerNavItem[] = [
    { label: "Visão geral", icon: LayoutDashboard, to: "/vendedor" },
    { label: "Meus anúncios", icon: Package, to: "/vendedor/anuncios" },
    { label: "Criar anúncio", icon: PackagePlus, to: "/vendedor/anuncios/novo" },
    { label: "Vendas", icon: ShoppingBag, to: "/vendedor/vendas" },
    { label: "Financeiro", icon: Wallet, to: "/vendedor/financeiro" },
    { label: "Avaliações", icon: Star, to: "/vendedor/avaliacoes" },
  ];

  if (publicSlug) {
    items.push({
      label: "Loja pública",
      icon: ExternalLink,
      to: "/loja/$slug",
      params: { slug: publicSlug },
      external: true,
    });
  }

  items.push({
    label: "Voltar para minha conta",
    icon: ArrowLeftRight,
    to: "/perfil",
    cta: true,
  });

  return (
    <nav
      aria-label="Navegação do vendedor"
      className={cn(
        isHorizontal
          ? "-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          : "flex flex-col gap-1 rounded-2xl border border-border bg-card p-3 shadow-card",
        className,
      )}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active =
          !item.external &&
          !item.cta &&
          (item.to === "/vendedor"
            ? currentPath === "/vendedor"
            : currentPath.startsWith(item.to));

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

        return (
          <Link
            key={item.label}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            to={item.to as any}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            params={item.params as any}
            className={baseClass}
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
            {item.external && (
              <BarChart3 className="ml-1 hidden h-3 w-3 opacity-0" aria-hidden />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
