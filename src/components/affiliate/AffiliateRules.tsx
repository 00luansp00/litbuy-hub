import { Info, AlertTriangle, ShieldAlert } from "lucide-react";
import type { AffiliateRule } from "@/types";

const TONE_MAP = {
  info: { icon: Info, wrap: "border-border", text: "text-foreground" },
  warning: { icon: AlertTriangle, wrap: "border-warning/40 bg-warning/5", text: "text-warning" },
  danger: { icon: ShieldAlert, wrap: "border-destructive/40 bg-destructive/5", text: "text-destructive" },
} as const;

export function AffiliateRules({ rules }: { rules: AffiliateRule[] }) {
  return (
    <section>
      <h2 className="mb-4 text-xl font-bold text-foreground">Regras do programa</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {rules.map((r) => {
          const t = TONE_MAP[r.tone];
          const Icon = t.icon;
          return (
            <div key={r.id} className={`rounded-2xl border bg-card p-4 ${t.wrap}`}>
              <div className={`flex items-center gap-2 text-sm font-semibold ${t.text}`}>
                <Icon className="h-4 w-4" /> {r.title}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
