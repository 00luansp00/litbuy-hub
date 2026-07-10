import type { ReactNode } from "react";
import { AccountSidebar } from "./AccountSidebar";
import { cn } from "@/lib/utils";

interface AccountLayoutProps {
  /** Renderizado acima do grid — normalmente <AccountHeader />. */
  header?: ReactNode;
  /** Título curto exibido logo acima do conteúdo. */
  title?: string;
  description?: string;
  /** Ações à direita do título (ex.: filtros, botão CTA). */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * AccountLayout — casca reutilizável da área do usuário.
 * Sidebar vertical no desktop, navegação horizontal scrollável no mobile.
 */
export function AccountLayout({
  header,
  title,
  description,
  actions,
  children,
  className,
}: AccountLayoutProps) {
  return (
    <div className={cn("container-lit space-y-6 py-6 md:space-y-8 md:py-10", className)}>
      {header}

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8">
        {/* Sidebar desktop */}
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <AccountSidebar orientation="vertical" />
          </div>
        </aside>

        {/* Navegação mobile/tablet */}
        <div className="lg:hidden">
          <AccountSidebar orientation="horizontal" />
        </div>

        {/* Conteúdo */}
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
