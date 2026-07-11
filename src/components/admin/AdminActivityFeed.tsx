import { icons, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminActivityEntry, AdminActivityTone } from "@/types";

const TONE: Record<AdminActivityTone, string> = {
  info: "bg-primary/10 text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-destructive/15 text-destructive",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.round(h / 24);
  return `há ${d}d`;
}

export function AdminActivityFeed({ entries }: { entries: AdminActivityEntry[] }) {
  if (!entries.length) {
    return (
      <p className="text-sm text-muted-foreground">Nenhuma atividade recente.</p>
    );
  }
  return (
    <ol className="space-y-3">
      {entries.map((e) => {
        const Icon =
          (icons as Record<string, React.ComponentType<{ className?: string }>>)[e.icon] ??
          Activity;
        return (
          <li
            key={e.id}
            className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/40 p-3"
          >
            <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", TONE[e.tone])}>
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{e.title}</p>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{e.description}</p>
            </div>
            <span className="whitespace-nowrap text-[11px] text-muted-foreground">
              {timeAgo(e.createdAt)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
