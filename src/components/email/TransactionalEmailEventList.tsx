import { Badge } from "@/components/ui/badge";
import type { TransactionalEmailEvent } from "@/types";

interface Props {
  events: TransactionalEmailEvent[];
  title?: string;
}

export function TransactionalEmailEventList({ events, title }: Props) {
  return (
    <section className="space-y-3">
      {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
      <ul className="grid gap-2 md:grid-cols-2">
        {events.map((e) => (
          <li
            key={e.id}
            className="rounded-xl border border-border bg-surface/40 p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">{e.label}</p>
              {e.critical && (
                <Badge variant="destructive" className="text-[10px]">crítico</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{e.description}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {e.channels.map((c) => (
                <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
