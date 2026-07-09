import { BadgeCheck, Flame, Sparkles, Tag, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";

type BadgeKind = "instant" | "verified" | "bestSeller" | "new" | "promo";

interface ProductBadgesProps {
  product: Pick<
    Product,
    "instantDelivery" | "verifiedSeller" | "badge" | "discountPercent" | "soldCount"
  > & { bestSeller?: boolean };
  /** Onde os selos serão renderizados — muda o estilo padrão. */
  variant?: "overlay" | "inline";
  /** Restringe quais selos exibir. Se omitido, exibe todos disponíveis. */
  include?: BadgeKind[];
  className?: string;
}

const CONFIG: Record<
  BadgeKind,
  { label: string; icon: typeof Zap; tone: string }
> = {
  instant: {
    label: "Instantâneo",
    icon: Zap,
    tone: "bg-warning/15 text-warning border-warning/30",
  },
  verified: {
    label: "Verificado",
    icon: BadgeCheck,
    tone: "bg-accent/15 text-accent border-accent/30",
  },
  bestSeller: {
    label: "Mais vendido",
    icon: Flame,
    tone: "bg-primary/15 text-primary border-primary/30",
  },
  new: {
    label: "Novo",
    icon: Sparkles,
    tone: "bg-success/15 text-success border-success/30",
  },
  promo: {
    label: "Oferta",
    icon: Tag,
    tone: "bg-destructive/15 text-destructive border-destructive/30",
  },
};

function resolveBadges(product: ProductBadgesProps["product"]): BadgeKind[] {
  const out: BadgeKind[] = [];
  if (product.instantDelivery) out.push("instant");
  if (product.verifiedSeller) out.push("verified");
  if (product.bestSeller || product.badge === "top" || (product.soldCount ?? 0) >= 5000)
    out.push("bestSeller");
  if (product.badge === "new") out.push("new");
  if (product.discountPercent || product.badge === "promo") out.push("promo");
  return out;
}

/**
 * ProductBadges — selos reutilizáveis do catálogo.
 * Usado no ProductCard, na página de produto e em qualquer lugar que precise
 * exibir os atributos rápidos do anúncio.
 */
export function ProductBadges({
  product,
  variant = "inline",
  include,
  className,
}: ProductBadgesProps) {
  const kinds = resolveBadges(product).filter((k) => !include || include.includes(k));
  if (kinds.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {kinds.map((kind) => {
        const { label, icon: Icon, tone } = CONFIG[kind];
        return (
          <span
            key={kind}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold backdrop-blur",
              tone,
              variant === "overlay" && "bg-background/70",
            )}
          >
            <Icon className="h-3 w-3" />
            {label}
          </span>
        );
      })}
    </div>
  );
}
