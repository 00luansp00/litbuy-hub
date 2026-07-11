import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sellerDashboardService } from "@/services/sellerDashboardService";
import type { Seller } from "@/types";
import { SellerDashboardHeader } from "./SellerDashboardHeader";
import { SellerDashboardSidebar } from "./SellerDashboardSidebar";

interface SellerDashboardLayoutProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Oculta o CTA "Criar anúncio" quando já está na página de criar. */
  hideCreateCta?: boolean;
}

/**
 * SellerDashboardLayout — casca reutilizável da Área do Vendedor.
 * Header + sidebar/menu + área de conteúdo + CTA principal.
 */
export function SellerDashboardLayout({
  title,
  description,
  actions,
  children,
  className,
  hideCreateCta,
}: SellerDashboardLayoutProps) {
  const [seller, setSeller] = useState<Seller | null>(null);

  useEffect(() => {
    let mounted = true;
    sellerDashboardService.getCurrentSeller().then((s) => {
      if (mounted) setSeller(s);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className={cn("container-lit space-y-6 py-6 md:space-y-8 md:py-10", className)}>
      {seller && <SellerDashboardHeader seller={seller} />}

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <SellerDashboardSidebar publicSlug={seller?.slug} orientation="vertical" />
          </div>
        </aside>

        <div className="lg:hidden">
          <SellerDashboardSidebar publicSlug={seller?.slug} orientation="horizontal" />
        </div>

        <div className="min-w-0 space-y-6 md:space-y-8">
          {(title || actions || !hideCreateCta) && (
            <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                {title && (
                  <h2 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">
                    {title}
                  </h2>
                )}
                {description && (
                  <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {actions}
                {!hideCreateCta && (
                  <Button asChild size="sm">
                    <Link to="/vendedor/anuncios/novo">
                      <PackagePlus className="mr-2 h-4 w-4" /> Criar anúncio
                    </Link>
                  </Button>
                )}
              </div>
            </header>
          )}

          {children}
        </div>
      </div>
    </div>
  );
}
