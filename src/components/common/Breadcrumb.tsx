import { Link } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";
import { Fragment } from "react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  /** Rota tipada do TanStack Router (ex: "/", "/categoria/$slug"). */
  to?: string;
  /** Parâmetros de rota, quando `to` contém segmentos dinâmicos. */
  params?: Record<string, string>;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  /** Exibe o ícone de "Home" antes do primeiro item. */
  showHomeIcon?: boolean;
  className?: string;
}

/**
 * Breadcrumb reutilizável — aceita qualquer quantidade de níveis.
 * Estrutura semântica <nav><ol> para acessibilidade.
 */
export function Breadcrumb({ items, showHomeIcon = true, className }: BreadcrumbProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("text-xs md:text-sm text-muted-foreground", className)}
    >
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          const content = (
            <span className="inline-flex items-center gap-1">
              {i === 0 && showHomeIcon && <Home className="h-3.5 w-3.5" />}
              {item.label}
            </span>
          );
          return (
            <Fragment key={`${item.label}-${i}`}>
              <li className="min-w-0">
                {item.to && !isLast ? (
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  <Link
                    to={item.to as any}
                    params={item.params as any}
                    className="transition-colors hover:text-foreground"
                  >
                    {content}
                  </Link>
                ) : (
                  <span
                    aria-current={isLast ? "page" : undefined}
                    className={cn(isLast && "font-medium text-foreground")}
                  >
                    {content}
                  </span>
                )}
              </li>
              {!isLast && <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
