import { Link } from "@tanstack/react-router";
import { icons, PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** Nome do ícone lucide. Padrão: `PackageOpen`. */
  icon?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    to: string;
    params?: Record<string, string>;
  };
  className?: string;
}

/**
 * EmptyState — estado vazio reutilizável em listagens, buscas e filtros.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const Icon =
    (icon &&
      (icons as Record<string, React.ComponentType<{ className?: string }>>)[icon]) ||
    PackageOpen;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center",
        className,
      )}
    >
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-surface text-muted-foreground">
        <Icon className="h-8 w-8" />
      </span>
      <div className="space-y-1.5">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && (
        <Button asChild variant="secondary">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <Link to={action.to as any} params={action.params as any}>
            {action.label}
          </Link>
        </Button>
      )}
    </div>
  );
}
