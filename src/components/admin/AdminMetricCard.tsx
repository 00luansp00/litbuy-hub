import { motion } from "motion/react";
import { icons, TrendingDown, TrendingUp, Minus, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminMetric, AdminMetricTone } from "@/types";

const TONE_STYLES: Record<AdminMetricTone, string> = {
  primary: "bg-primary/10 text-primary",
  accent: "bg-accent/15 text-accent-foreground",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-destructive/15 text-destructive",
  muted: "bg-muted text-muted-foreground",
};

export function AdminMetricCard({ metric, index = 0 }: { metric: AdminMetric; index?: number }) {
  const Icon =
    (icons as Record<string, React.ComponentType<{ className?: string }>>)[metric.icon] ?? Package;
  const tone = metric.tone ?? "primary";
  const dir = metric.deltaDirection ?? "neutral";
  const DirIcon = dir === "up" ? TrendingUp : dir === "down" ? TrendingDown : Minus;
  const dirClass =
    dir === "up" ? "text-success" : dir === "down" ? "text-destructive" : "text-muted-foreground";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className="group rounded-2xl border border-border bg-card p-4 shadow-card transition-colors hover:border-primary/40 md:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {metric.label}
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{metric.value}</p>
        </div>
        <span className={cn("grid h-10 w-10 place-items-center rounded-xl", TONE_STYLES[tone])}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      {(metric.delta || metric.hint) && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          {metric.delta && (
            <span className={cn("inline-flex items-center gap-1 font-medium", dirClass)}>
              <DirIcon className="h-3.5 w-3.5" /> {metric.delta}
            </span>
          )}
          {metric.hint && <span className="text-muted-foreground">{metric.hint}</span>}
        </div>
      )}
    </motion.div>
  );
}
