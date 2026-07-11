import { AlertCircle, CheckCircle2, Clock, Info } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { VerificationTimelineEvent } from "@/types";

const ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: AlertCircle,
  muted: Clock,
} as const;

export function VerificationTimeline({ events }: { events: VerificationTimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>
    );
  }
  return (
    <ol className="space-y-3">
      {events.map((e) => {
        const Icon = ICONS[e.tone];
        return (
          <li key={e.id} className="flex gap-3 rounded-xl border border-border bg-surface/40 p-3">
            <span
              className={cn(
                "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                e.tone === "success" && "bg-success/15 text-success",
                e.tone === "info" && "bg-primary/15 text-primary",
                e.tone === "warning" && "bg-warning/15 text-warning",
                e.tone === "muted" && "bg-muted/30 text-muted-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{e.title}</p>
              {e.description && (
                <p className="text-xs text-muted-foreground">{e.description}</p>
              )}
              <time className="text-[11px] text-muted-foreground">
                {formatDistanceToNow(new Date(e.date), { locale: ptBR, addSuffix: true })}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
