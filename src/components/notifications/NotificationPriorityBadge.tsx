import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { NotificationPriority } from "@/types";

const LABEL: Record<NotificationPriority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
};

const TONE: Record<NotificationPriority, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-primary/15 text-primary border-primary/30",
  high: "bg-warning/15 text-warning border-warning/30",
  critical: "bg-destructive/15 text-destructive border-destructive/30",
};

export function NotificationPriorityBadge({
  priority,
  className,
}: {
  priority: NotificationPriority;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("text-[10px]", TONE[priority], className)}
    >
      {LABEL[priority]}
    </Badge>
  );
}
