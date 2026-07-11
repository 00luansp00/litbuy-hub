import { Check, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ListingPromotionTier, PromotionTierInfo } from "@/types";

interface Props {
  tiers: PromotionTierInfo[];
  value?: ListingPromotionTier;
  onChange: (t: ListingPromotionTier) => void;
}

export function PromotionCards({ tiers, value, onChange }: Props) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {tiers.map((t) => {
        const active = value === t.tier;
        return (
          <button
            key={t.tier}
            type="button"
            onClick={() => onChange(t.tier)}
            className={cn(
              "group relative rounded-2xl border p-4 text-left transition-all",
              active
                ? "border-primary bg-primary/5 shadow-glow"
                : "border-border bg-card hover:border-primary/40",
            )}
          >
            {t.recommended && (
              <Badge className="absolute -top-2 right-3 gap-1 bg-primary text-primary-foreground">
                <Sparkles className="h-3 w-3" /> Recomendado
              </Badge>
            )}
            <div className="mb-2 flex items-center justify-between">
              <div className="text-lg font-bold text-foreground">{t.name}</div>
              {active && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">{t.tagline}</p>
            <ul className="mt-3 space-y-1.5 text-xs">
              {t.benefits.map((b) => (
                <li key={b} className="flex items-start gap-1.5">
                  <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                  <span className="text-foreground/80">{b}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 border-t border-border pt-2 text-[11px] text-muted-foreground">
              Taxa demonstrativa: <span className="font-semibold">{t.demoFeePct}%</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
