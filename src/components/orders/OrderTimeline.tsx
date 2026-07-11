import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrderTimelineEvent } from "@/types";

export function OrderTimeline({ events }: { events: OrderTimelineEvent[] }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card md:p-6">
      <header className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">Linha do tempo</h2>
        <p className="text-xs text-muted-foreground">
          Acompanhe cada etapa do pedido — dados mockados.
        </p>
      </header>
      <ol className="space-y-4">
        {events.map((e, i) => {
          const Icon = e.pending ? Circle : CheckCircle2;
          const last = i === events.length - 1;
          return (
            <li key={e.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <Icon
                  className={cn(
                    "h-5 w-5 shrink-0",
                    e.pending ? "text-muted-foreground/60" : "text-success",
                  )}
                />
                {!last && (
                  <span
                    className={cn(
                      "mt-1 w-px flex-1",
                      e.pending ? "bg-border" : "bg-success/40",
                    )}
                  />
                )}
              </div>
              <div className="min-w-0 flex-1 pb-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      e.pending ? "text-muted-foreground" : "text-foreground",
                    )}
                  >
                    {e.label}
                  </p>
                  <time className="text-[11px] text-muted-foreground">
                    {new Date(e.at).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </time>
                </div>
                {e.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {e.description}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
