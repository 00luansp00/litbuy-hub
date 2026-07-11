import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AdminHeader } from "./AdminHeader";
import { AdminSidebar } from "./AdminSidebar";

interface AdminLayoutProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * AdminLayout — casca reutilizável do Painel Administrativo.
 * Header + sidebar (desktop) / menu horizontal (mobile) + área de conteúdo.
 */
export function AdminLayout({
  title,
  description,
  actions,
  children,
  className,
}: AdminLayoutProps) {
  return (
    <div className={cn("container-lit space-y-6 py-6 md:space-y-8 md:py-10", className)}>
      <AdminHeader />

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <AdminSidebar orientation="vertical" />
          </div>
        </aside>

        <div className="lg:hidden">
          <AdminSidebar orientation="horizontal" />
        </div>

        <div className="min-w-0 space-y-6 md:space-y-8">
          {(title || actions) && (
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
              {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
            </header>
          )}

          {children}
        </div>
      </div>
    </div>
  );
}
