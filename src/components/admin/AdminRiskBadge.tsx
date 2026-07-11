import { AlertTriangle, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AdminRiskLevel } from "@/types";

const CFG: Record<AdminRiskLevel, { label: string; style: string; Icon: typeof ShieldCheck }> = {
  low: {
    label: "Baixo",
    style: "bg-success/15 text-success border-success/30",
    Icon: ShieldCheck,
  },
  medium: {
    label: "Médio",
    style: "bg-warning/15 text-warning border-warning/30",
    Icon: ShieldQuestion,
  },
  high: {
    label: "Alto",
    style: "bg-destructive/15 text-destructive border-destructive/30",
    Icon: ShieldAlert,
  },
  critical: {
    label: "Crítico",
    style: "bg-destructive text-destructive-foreground border-destructive",
    Icon: AlertTriangle,
  },
};

export function AdminRiskBadge({
  risk,
  className,
}: {
  risk: AdminRiskLevel;
  className?: string;
}) {
  const { label, style, Icon } = CFG[risk];
  return (
    <Badge
      variant="outline"
      className={cn("gap-1 border text-[10px] font-medium", style, className)}
    >
      <Icon className="h-3 w-3" /> {label}
    </Badge>
  );
}
