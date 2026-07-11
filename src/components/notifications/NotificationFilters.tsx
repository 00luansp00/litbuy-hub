import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NotificationFilter } from "@/types";

interface Props {
  filters: NotificationFilter[];
  activeId: string;
  onChange: (id: string) => void;
  counts?: Partial<Record<string, number>>;
}

export function NotificationFilters({
  filters,
  activeId,
  onChange,
  counts,
}: Props) {
  return (
    <div
      role="tablist"
      aria-label="Filtros de notificações"
      className="flex flex-nowrap gap-2 overflow-x-auto pb-2 md:flex-wrap md:overflow-visible"
    >
      {filters.map((f) => {
        const active = f.id === activeId;
        const count = counts?.[f.id];
        return (
          <Button
            key={f.id}
            role="tab"
            aria-selected={active}
            type="button"
            variant={active ? "default" : "outline"}
            size="sm"
            onClick={() => onChange(f.id)}
            className={cn(
              "shrink-0 text-xs",
              !active && "border-border bg-card",
            )}
          >
            {f.label}
            {count !== undefined && count > 0 && (
              <span
                className={cn(
                  "ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px]",
                  active
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {count}
              </span>
            )}
          </Button>
        );
      })}
    </div>
  );
}
