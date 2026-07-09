import { BadgeCheck, Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Seller } from "@/types";

interface SellerInfoProps {
  seller: Seller;
  /** Número total de vendas do vendedor (mock). */
  salesCount?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const AVATAR_SIZE = { sm: "h-6 w-6", md: "h-8 w-8", lg: "h-11 w-11" };
const NAME_SIZE = { sm: "text-xs", md: "text-sm", lg: "text-base" };

/**
 * SellerInfo — bloco de identidade do vendedor.
 * Reutilizado em ProductCard, página do produto, checkout, pedidos e perfil.
 */
export function SellerInfo({ seller, salesCount, size = "sm", className }: SellerInfoProps) {
  const initials = seller.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={cn("flex items-center gap-2 min-w-0", className)}>
      <Avatar className={cn(AVATAR_SIZE[size], "border border-border")}>
        {seller.avatarUrl && <AvatarImage src={seller.avatarUrl} alt={seller.name} />}
        <AvatarFallback className="bg-surface text-[10px] font-semibold">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className={cn("flex items-center gap-1 truncate", NAME_SIZE[size])}>
          <span className="truncate font-medium text-foreground">{seller.name}</span>
          {seller.verified && (
            <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-accent" aria-label="Verificado" />
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-0.5">
            <Star className="h-3 w-3 fill-warning text-warning" />
            {seller.rating.toFixed(1)}
          </span>
          {salesCount != null && <span>{formatCompact(salesCount)} vendas</span>}
        </div>
      </div>
    </div>
  );
}
