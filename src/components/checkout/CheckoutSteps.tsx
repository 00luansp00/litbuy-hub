import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CheckoutStep } from "@/types";

const STEPS: { id: CheckoutStep; label: string }[] = [
  { id: "review", label: "Revisão" },
  { id: "payment", label: "Pagamento" },
  { id: "success", label: "Confirmação" },
];

export function CheckoutSteps({ current }: { current: CheckoutStep }) {
  const currentIndex = STEPS.findIndex((s) => s.id === current);
  return (
    <ol className="flex items-center gap-2 text-xs sm:text-sm">
      {STEPS.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <li key={step.id} className="flex items-center gap-2">
            <span
              className={cn(
                "grid h-7 w-7 place-items-center rounded-full border font-semibold transition-colors",
                done && "border-success bg-success text-success-foreground",
                active && "border-primary bg-primary text-primary-foreground",
                !done && !active && "border-border bg-card text-muted-foreground",
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span
              className={cn(
                "hidden sm:inline",
                active ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
            {i < STEPS.length - 1 && (
              <span className="mx-1 h-px w-6 bg-border sm:w-10" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}
