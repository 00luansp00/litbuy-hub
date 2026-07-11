import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  MessageSquare,
  Package,
  Truck,
  UserPlus,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { SellerTeamActivityEvent } from "@/types";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  MessageSquare,
  Package,
  Truck,
  Wallet,
  UserPlus,
};

const TONE = {
  info: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  muted: "bg-muted/30 text-muted-foreground",
} as const;

export function SellerTeamActivity({ events }: { events: SellerTeamActivityEvent[] }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <header className="mb-3">
        <h3 className="text-base font-semibold text-foreground">Atividade recente</h3>
        <p className="text-xs text-muted-foreground">Timeline mockada. Auditoria real virá com backend.</p>
      </header>
      <ol className="space-y-2">
        {events.map((e) => {
          const Icon = ICONS[e.icon] ?? MessageSquare;
          return (
            <li key={e.id} className="flex items-start gap-3 rounded-xl border border-border bg-surface/40 p-3">
              <span className={cn("grid h-8 w-8 place-items-center rounded-lg", TONE[e.tone])}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground">
                  <strong>{e.memberName}</strong> {e.action}{" "}
                  {e.target && <span className="text-muted-foreground">— {e.target}</span>}
                </p>
                <time className="text-[11px] text-muted-foreground">
                  {formatDistanceToNow(new Date(e.date), { locale: ptBR, addSuffix: true })}
                </time>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
