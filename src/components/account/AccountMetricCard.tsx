import { motion } from "motion/react";
import { icons, ArrowDownRight, ArrowUpRight, Minus, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AccountMetric, AccountMetricTone } from "@/types";

interface AccountMetricCardProps {
  metric: AccountMetric;
  index?: number;
  className?: string;
}

const TONE: Record<AccountMetricTone, string> = {
  primary: "text-primary bg-primary/12",
  accent: "text-accent bg-accent/12",
  success: "text-success bg-success/12",
  warning: "text-warning bg-warning/12",
  muted: "text-muted-foreground bg-surface",
};

/**
 * AccountMetricCard — card único de métrica na dashboard do usuário.
 */
export function AccountMetricCard({
  metric,
  index = 0,
  className,
}: AccountMetricCardProps) {
  const Icon =
    (icons as Record<string, React.ComponentType<{ className?: string }>>)[
      metric.icon
    ] ?? HelpCircle;

  const tone = TONE[metric.tone ?? "primary"];
  const dir = metric.deltaDirection ?? "neutral";
  const DirIcon =
    dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus;
  const dirTone =
    dir === "up"
      ? "text-success"
      : dir === "down"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.3) }}
      className={cn(
        "rounded-2xl border border-border bg-card p-4 shadow-card transition-colors hover:border-primary/40 md:p-5",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className={cn("grid h-10 w-10 place-items-center rounded-xl", tone)}>
          <Icon className="h-4 w-4" />
        </span>
        {metric.delta && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full bg-surface/70 px-2 py-0.5 text-[11px] font-medium",
              dirTone,
            )}
          >
            <DirIcon className="h-3 w-3" /> {metric.delta}
          </span>
        )}
      </div>
      <div className="mt-3 text-2xl font-bold tracking-tight text-foreground">
        {metric.value}
      </div>
      <div className="mt-0.5 text-xs uppercase tracking-wide text-muted-foreground">
        {metric.label}
      </div>
      {metric.hint && (
        <p className="mt-2 text-xs text-muted-foreground/80">{metric.hint}</p>
      )}
    </motion.div>
  );
}
