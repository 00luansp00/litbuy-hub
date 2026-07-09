import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Heart, ShoppingCart, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBRL, formatCompact } from "@/lib/format";
import type { Product } from "@/types";

const badgeLabel: Record<NonNullable<Product["badge"]>, string> = {
  hot: "Em alta",
  new: "Novo",
  promo: "Promo",
  top: "Top",
};

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <motion.article
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card hover:border-primary/40 transition-colors"
    >
      <Link
        to="/produto/$id"
        params={{ id: product.slug }}
        className="relative block aspect-square overflow-hidden bg-surface"
      >
        <img
          src={product.imageUrl}
          alt={product.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {product.badge && (
          <Badge className="absolute left-3 top-3 border-0 bg-primary/90 text-primary-foreground backdrop-blur">
            {badgeLabel[product.badge]}
          </Badge>
        )}
        {product.discountPercent && (
          <span className="absolute right-3 top-3 rounded-md bg-success px-2 py-0.5 text-xs font-semibold text-success-foreground">
            -{product.discountPercent}%
          </span>
        )}
        <button
          type="button"
          aria-label="Favoritar"
          className="absolute right-3 bottom-3 grid h-9 w-9 place-items-center rounded-full bg-background/70 text-foreground opacity-0 backdrop-blur transition group-hover:opacity-100 hover:bg-primary hover:text-primary-foreground"
        >
          <Heart className="h-4 w-4" />
        </button>
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{product.categoryName}</span>
          <span className="inline-flex items-center gap-1">
            <Star className="h-3 w-3 fill-warning text-warning" />
            {product.rating.toFixed(1)}
            <span className="text-muted-foreground/70">
              ({formatCompact(product.reviewsCount)})
            </span>
          </span>
        </div>

        <Link
          to="/produto/$id"
          params={{ id: product.slug }}
          className="line-clamp-2 text-sm font-medium leading-snug text-foreground hover:text-primary transition-colors"
        >
          {product.title}
        </Link>

        <div className="mt-auto flex items-end justify-between gap-2">
          <div>
            {product.originalPrice && (
              <div className="text-xs text-muted-foreground line-through">
                {formatBRL(product.originalPrice)}
              </div>
            )}
            <div className="text-lg font-bold text-foreground">
              {formatBRL(product.price)}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {formatCompact(product.soldCount)} vendidos
            </div>
          </div>
          <Button size="icon" variant="default" aria-label="Comprar">
            <ShoppingCart className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.article>
  );
}
