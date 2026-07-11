import { useState } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportDialog } from "./ReportDialog";
import type { ReportContext, ReportSource, ReportTargetType } from "@/types";

type BtnVariant = "default" | "outline" | "ghost" | "secondary" | "destructive" | "link";
type BtnSize = "default" | "sm" | "lg" | "icon";

interface Props {
  targetType: ReportTargetType;
  targetId: string;
  targetLabel: string;
  label?: string;
  context?: ReportContext;
  source?: ReportSource;
  defaultReason?: string;
  variant?: BtnVariant;
  size?: BtnSize;
  className?: string;
  iconOnly?: boolean;
}

export function ReportButton({
  targetType,
  targetId,
  targetLabel,
  label = "Reportar",
  context,
  source,
  defaultReason,
  variant = "ghost",
  size = "sm",
  className,
  iconOnly,
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={iconOnly ? "icon" : size}
        onClick={() => setOpen(true)}
        className={className}
        aria-label={iconOnly ? label : undefined}
      >
        <Flag className="h-3.5 w-3.5" />
        {!iconOnly && <span className="ml-1">{label}</span>}
      </Button>
      <ReportDialog
        open={open}
        onOpenChange={setOpen}
        targetType={targetType}
        targetId={targetId}
        targetLabel={targetLabel}
        context={context}
        source={source}
        defaultReason={defaultReason}
      />
    </>
  );
}
