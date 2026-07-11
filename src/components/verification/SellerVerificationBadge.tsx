import { useEffect, useState } from "react";
import { BadgeCheck } from "lucide-react";
import { verificationService } from "@/services/verificationService";
import type { SellerVerificationBadge as Badge } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  sellerId: string;
  size?: "sm" | "md";
  className?: string;
}

/**
 * SellerVerificationBadge — selo visual "Vendedor Verificado".
 * Só renderiza quando o vendedor mockado tem verificationStatus === "approved".
 */
export function SellerVerificationBadge({ sellerId, size = "md", className }: Props) {
  const [badge, setBadge] = useState<Badge | null>(null);
  useEffect(() => {
    verificationService.getSellerVerificationBadge(sellerId).then(setBadge);
  }, [sellerId]);

  if (!badge) return null;

  return (
    <span
      aria-label={badge.label}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 font-medium text-success",
        size === "sm" ? "text-[10px]" : "text-xs",
        className,
      )}
    >
      <BadgeCheck className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {badge.label}
    </span>
  );
}
