import { Check, Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SellerPlanInfo, SellerPlanType } from "@/types";

interface Props {
  plans: SellerPlanInfo[];
  value?: SellerPlanType;
  onChange: (p: SellerPlanType) => void;
}

export function LitMaxPlanCard({ plans, value, onChange }: Props) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {plans.map((p) => {
        const active = value === p.plan;
        return (
          <button
            key={p.plan}
            type="button"
            onClick={() => onChange(p.plan)}
            className={cn(
              "relative rounded-2xl border p-4 text-left transition-all",
              active
                ? "border-primary bg-primary/5 shadow-glow"
                : "border-border bg-card hover:border-primary/40",
              p.premium && "bg-gradient-to-br from-primary/10 to-transparent",
            )}
          >
            {p.premium && (
              <Badge className="absolute -top-2 right-3 gap-1 bg-primary text-primary-foreground">
                <Crown className="h-3 w-3" /> Premium
              </Badge>
            )}
            <div className="mb-1 text-lg font-bold text-foreground">{p.name}</div>
            <p className="text-xs text-muted-foreground">{p.tagline}</p>
            <ul className="mt-3 space-y-1.5 text-xs">
              {p.benefits.map((b) => (
                <li key={b} className="flex items-start gap-1.5">
                  <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                  <span className="text-foreground/80">{b}</span>
                </li>
              ))}
            </ul>
          </button>
        );
      })}
    </div>
  );
}
