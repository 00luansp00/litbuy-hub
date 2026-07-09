import { Link } from "@tanstack/react-router";
import { Package, Star } from "lucide-react";
import { ProductBadges } from "@/components/common/ProductBadges";
import { formatBRL, formatCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";

interface ProductInfoProps {
  product: Product;
  className?: string;
}

/**
 * ProductInfo — título, categoria, badges, preço e metadados do produto.
 * Bloco de leitura; a ação de compra vive no PurchaseCard.
 */
export function ProductInfo({ product, className }: ProductInfoProps) {
  return (
    <div className={cn("space-y-5", className)}>
      <div className="space-y-2">
        <Link
          to="/categoria/$slug"
          params={{ slug: product.categorySlug }}
          className="text-xs font-medium uppercase tracking-widest text-muted-foreground hover:text-primary"
        >
          {product.categoryName}
        </Link>
        <h1 className="text-2xl font-bold leading-tight text-foreground md:text-3xl">
          {product.title}
        </h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Star className="h-4 w-4 fill-warning text-warning" />
            <span className="font-semibold text-foreground">
              {product.rating.toFixed(1)}
            </span>
            <span>({formatCompact(product.reviewsCount)} avaliações)</span>
          </span>
          <span aria-hidden>•</span>
          <span>{formatCompact(product.soldCount)} vendidos</span>
          {product.stock != null && (
            <>
              <span aria-hidden>•</span>
              <span className="inline-flex items-center gap-1">
                <Package className="h-3.5 w-3.5" />
                {product.stock > 0 ? `${product.stock} em estoque` : "Esgotado"}
              </span>
            </>
          )}
        </div>
      </div>

      <ProductBadges product={product} />

      <div className="flex items-end gap-3">
        {product.originalPrice && (
          <span className="text-sm text-muted-foreground line-through">
            {formatBRL(product.originalPrice)}
          </span>
        )}
        <span className="text-3xl font-bold text-foreground md:text-4xl">
          {formatBRL(product.price)}
        </span>
        {product.discountPercent && (
          <span className="rounded-md bg-success px-2 py-1 text-xs font-semibold text-success-foreground">
            -{product.discountPercent}%
          </span>
        )}
      </div>

      {product.description && (
        <p className="text-sm leading-relaxed text-muted-foreground">
          {product.description}
        </p>
      )}
    </div>
  );
}
