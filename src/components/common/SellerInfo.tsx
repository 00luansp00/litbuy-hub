import { BadgeCheck, Clock, Star, TrendingUp, CalendarDays } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Seller } from "@/types";

interface SellerInfoProps {
  seller: Seller;
  /** Sobrescreve `seller.salesCount` quando necessário. */
  salesCount?: number;
  size?: "sm" | "md" | "lg";
  /** Exibe bloco expandido com nível, tempo de resposta e "membro desde". */
  detailed?: boolean;
  /** Se fornecido, torna o nome do vendedor um link para a rota informada. */
  href?: string;
  /** Params de rota (usado com `href` quando a rota é dinâmica). */
  hrefParams?: Record<string, string>;
  className?: string;
}

const AVATAR_SIZE = { sm: "h-6 w-6", md: "h-8 w-8", lg: "h-11 w-11" };
const NAME_SIZE = { sm: "text-xs", md: "text-sm", lg: "text-base" };

/**
 * SellerInfo — bloco de identidade do vendedor.
 * Reutilizado em ProductCard, página do produto, checkout, pedidos e perfil.
 * Passando `href`, o nome vira link para o perfil público (`/loja/$slug`).
 */
export function SellerInfo({
  seller,
  salesCount,
  size = "sm",
  detailed = false,
  href,
  hrefParams,
  className,
}: SellerInfoProps) {
  const initials = seller.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const sales = salesCount ?? seller.salesCount;

  const nameNode = (
    <span className="truncate font-medium text-foreground">{seller.name}</span>
  );

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-center gap-2 min-w-0">
        <Avatar className={cn(AVATAR_SIZE[size], "border border-border")}>
          {seller.avatarUrl && <AvatarImage src={seller.avatarUrl} alt={seller.name} />}
          <AvatarFallback className="bg-surface text-[10px] font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className={cn("flex items-center gap-1 truncate", NAME_SIZE[size])}>
            {href ? (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <Link
                to={href as any}
                params={hrefParams as any}
                className="truncate transition-colors hover:text-primary"
              >
                {nameNode}
              </Link>
            ) : (
              nameNode
            )}
            {seller.verified && (
              <BadgeCheck
                className="h-3.5 w-3.5 shrink-0 text-accent"
                aria-label="Verificado"
              />
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-0.5">
              <Star className="h-3 w-3 fill-warning text-warning" />
              {seller.rating.toFixed(1)}
            </span>
            {sales != null && <span>{formatCompact(sales)} vendas</span>}
            {detailed && seller.level && (
              <span className="rounded bg-primary/15 px-1.5 py-0.5 font-medium text-primary">
                {seller.level}
              </span>
            )}
          </div>
        </div>
      </div>

      {detailed && (
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-xs">
          {seller.responseTime && (
            <DetailRow icon={Clock} label="Responde em" value={seller.responseTime} />
          )}
          {sales != null && (
            <DetailRow
              icon={TrendingUp}
              label="Vendas totais"
              value={formatCompact(sales)}
            />
          )}
          {seller.memberSince && (
            <DetailRow
              icon={CalendarDays}
              label="Membro desde"
              value={new Date(seller.memberSince).toLocaleDateString("pt-BR", {
                month: "short",
                year: "numeric",
              })}
            />
          )}
          <DetailRow
            icon={Star}
            label="Avaliação"
            value={`${seller.rating.toFixed(1)} / 5.0`}
          />
        </dl>
      )}
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <dt className="text-muted-foreground">{label}</dt>
        <dd className="truncate font-medium text-foreground">{value}</dd>
      </div>
    </div>
  );
}
