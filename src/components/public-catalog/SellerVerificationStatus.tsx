import { BadgeCheck, BadgeX } from "lucide-react";
import { cn } from "@/lib/utils";

export function SellerVerificationStatus({
  verified,
  className,
}: {
  verified: boolean;
  className?: string;
}) {
  const Icon = verified ? BadgeCheck : BadgeX;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        verified
          ? "border-success/40 bg-success/10 text-success"
          : "border-border bg-muted text-muted-foreground",
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {verified ? "Vendedor verificado" : "Vendedor não verificado"}
    </span>
  );
}
