import { useEffect, useState } from "react";
import { Award, Crown, Gem, Medal, Trophy } from "lucide-react";
import { sellerLevelService } from "@/services/sellerLevelService";
import type { SellerLevel } from "@/types";
import { cn } from "@/lib/utils";

const iconMap: Record<string, typeof Medal> = { Medal, Award, Crown, Gem, Trophy };

/**
 * SellerLevelBadge — selo compacto e discreto do nível do vendedor.
 * Mock. Não afeta comportamento.
 */
export function SellerLevelBadge({
  sellerId,
  size = "md",
  className,
}: {
  sellerId: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const [level, setLevel] = useState<SellerLevel | null>(null);
  useEffect(() => {
    sellerLevelService.getSellerLevelBySellerId(sellerId).then(setLevel);
  }, [sellerId]);

  if (!level) return null;
  const Icon = iconMap[level.icon] ?? Medal;

  return (
    <span
      aria-label={`Vendedor ${level.name}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border bg-surface/60 px-2 py-0.5 font-medium",
        size === "sm" ? "text-[10px]" : "text-xs",
        level.color,
        className,
      )}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      Vendedor {level.name}
    </span>
  );
}
