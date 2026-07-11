import { Link } from "@tanstack/react-router";
import { icons, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AdminAlert, AdminActivityTone } from "@/types";

const TONE: Record<AdminActivityTone, string> = {
  info: "border-primary/30 bg-primary/5",
  success: "border-success/30 bg-success/5",
  warning: "border-warning/30 bg-warning/5",
  danger: "border-destructive/40 bg-destructive/5",
};

const ICON_TONE: Record<AdminActivityTone, string> = {
  info: "bg-primary/15 text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-destructive/15 text-destructive",
};

export function AdminAlertCard({ alert }: { alert: AdminAlert }) {
  const Icon =
    (icons as Record<string, React.ComponentType<{ className?: string }>>)[alert.icon] ??
    AlertTriangle;
  return (
    <div className={cn("rounded-xl border p-4", TONE[alert.tone])}>
      <div className="flex items-start gap-3">
        <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-lg", ICON_TONE[alert.tone])}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{alert.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{alert.description}</p>
        </div>
      </div>
      {alert.action && (
        <div className="mt-3 flex justify-end">
          <Button asChild size="sm" variant="outline">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Link to={alert.action.to as any}>{alert.action.label}</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
