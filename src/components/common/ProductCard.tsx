import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Heart, ShieldCheck, ShoppingCart, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ProductBadges } from "./ProductBadges";
import { SellerInfo } from "./SellerInfo";
import { formatBRL, formatCompact } from "@/lib/format";
import { useCart } from "@/providers/CartProvider";
import type { Product } from "@/types";




interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const trustTone =
    (product.trustScore ?? 0) >= 90
      ? "text-success"
      : (product.trustScore ?? 0) >= 75
        ? "text-warning"
        : "text-muted-foreground";

  return (
    <motion.article
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card transition-all duration-300 hover:border-primary/50 hover:shadow-elegant"
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
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <ProductBadges
          product={product}
          variant="overlay"
          className="absolute left-3 top-3 max-w-[calc(100%-4rem)]"
        />
        {product.discountPercent && (
          <span className="absolute right-3 top-3 rounded-md bg-success px-2 py-0.5 text-xs font-semibold text-success-foreground shadow-card">
            -{product.discountPercent}%
          </span>
        )}
        <button
          type="button"
          aria-label="Favoritar"
          className="absolute right-3 bottom-3 grid h-9 w-9 place-items-center rounded-full bg-background/70 text-foreground opacity-0 backdrop-blur transition-all duration-200 group-hover:opacity-100 hover:bg-primary hover:text-primary-foreground hover:scale-110"
        >
          <Heart className="h-4 w-4" />
        </button>
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="truncate">{product.categoryName}</span>
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
          className="line-clamp-2 text-sm font-medium leading-snug text-foreground transition-colors hover:text-primary"
        >
          {product.title}
        </Link>

        {product.seller && (
          <SellerInfo seller={product.seller} />
        )}

        {product.trustScore != null && (
          <div className={`flex items-center gap-1 text-[11px] ${trustTone}`}>
            <ShieldCheck className="h-3.5 w-3.5" />
            {product.trustScore}% confiança
          </div>
        )}

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
          <Button
            size="icon"
            variant="default"
            aria-label="Comprar"
            className="transition-transform hover:scale-110"
          >
            <ShoppingCart className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.article>
  );
}
