import { motion } from "motion/react";
import { ArrowDownRight, ArrowUpRight, icons, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SellerPerformanceMetric } from "@/types";

interface SellerMetricCardProps {
  metric: SellerPerformanceMetric;
  index?: number;
}

const TONE_CLASS: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  accent: "bg-accent/10 text-accent",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  muted: "bg-surface text-muted-foreground",
};

export function SellerMetricCard({ metric, index = 0 }: SellerMetricCardProps) {
  const Icon =
    (icons as Record<string, React.ComponentType<{ className?: string }>>)[
      metric.icon
    ] ?? TrendingUp;
  const toneClass = TONE_CLASS[metric.tone ?? "muted"] ?? TONE_CLASS.muted;

  const DeltaIcon =
    metric.deltaDirection === "up"
      ? ArrowUpRight
      : metric.deltaDirection === "down"
        ? ArrowDownRight
        : TrendingUp;
  const deltaClass =
    metric.deltaDirection === "up"
      ? "text-success"
      : metric.deltaDirection === "down"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className="rounded-2xl border border-border bg-card p-4 shadow-card"
    >
      <div className="flex items-start justify-between gap-3">
        <span className={cn("grid h-10 w-10 place-items-center rounded-lg", toneClass)}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div className="mt-3 text-xs text-muted-foreground">{metric.label}</div>
      <div className="mt-0.5 text-2xl font-bold tracking-tight text-foreground">
        {metric.value}
      </div>
      {metric.delta && (
        <div className={cn("mt-2 inline-flex items-center gap-1 text-xs", deltaClass)}>
          <DeltaIcon className="h-3.5 w-3.5" />
          <span>{metric.delta}</span>
        </div>
      )}
    </motion.div>
  );
}
