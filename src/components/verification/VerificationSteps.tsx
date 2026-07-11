import { Camera, CheckCircle2, ClipboardCheck, IdCard, MessageSquare, UserRound, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VerificationStep } from "@/types";

const ICONS: Record<string, LucideIcon> = {
  UserRound,
  MessageSquare,
  IdCard,
  Camera,
  ClipboardCheck,
};

interface Props {
  steps: VerificationStep[];
  currentStepId: VerificationStep["id"];
  onSelect?: (id: VerificationStep["id"]) => void;
}

export function VerificationSteps({ steps, currentStepId, onSelect }: Props) {
  return (
    <ol className="grid gap-2 md:grid-cols-5">
      {steps.map((s, i) => {
        const Icon = ICONS[s.icon] ?? UserRound;
        const active = s.id === currentStepId;
        const done = s.status === "completed";
        return (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onSelect?.(s.id)}
              className={cn(
                "group flex w-full items-center gap-2 rounded-xl border p-3 text-left transition-colors",
                active
                  ? "border-primary/50 bg-primary/10"
                  : done
                    ? "border-success/40 bg-success/10"
                    : "border-border bg-surface/40 hover:bg-surface",
              )}
            >
              <span
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                  active ? "bg-primary/20 text-primary" : done ? "bg-success/20 text-success" : "bg-muted/40 text-muted-foreground",
                )}
              >
                {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </span>
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Etapa {i + 1}
                </div>
                <div className="truncate text-sm font-medium text-foreground">{s.title}</div>
              </div>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
