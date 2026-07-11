import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AdminDashboardSectionProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function AdminDashboardSection({
  title,
  description,
  actions,
  children,
  className,
}: AdminDashboardSectionProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card p-4 shadow-card md:p-6",
        className,
      )}
    >
      <header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground md:text-lg">{title}</h3>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground md:text-sm">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </header>
      {children}
    </section>
  );
}
