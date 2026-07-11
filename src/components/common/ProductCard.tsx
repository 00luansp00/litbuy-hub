import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Heart, ShieldCheck, ShoppingCart, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductBadges } from "./ProductBadges";
import { SellerInfo } from "./SellerInfo";
import { formatBRL, formatCompact } from "@/lib/format";
import { useCart } from "@/providers/CartProvider";
import { getUnavailabilityReason } from "@/services/productService";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";

interface ProductCardProps {
  product: Product;
}

function isServiceQuote(p: Product): boolean {
  return (
    (p.listingModel === "service" || p.productType === "service") &&
    p.servicePricingType === "quote"
  );
}

export function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart();
  const unavailability = getUnavailabilityReason(product);
  const isAvailable = !unavailability;
  const isDynamic = product.listingModel === "dynamic";
  const isService = product.listingModel === "service" || product.productType === "service";
  const isVirtualCurrency =
    product.productType === "virtual_currency" || !!product.virtualCurrency;
  const isQuote = isServiceQuote(product);

  const requiresPage = isDynamic || isVirtualCurrency || isQuote;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (requiresPage) {
      toast.info(
        isDynamic
          ? "Selecione uma variação na página do anúncio."
          : isVirtualCurrency
            ? "Escolha a quantidade na página do anúncio."
            : "Este serviço exige contato com o vendedor.",
      );
      return;
    }
    if (unavailability) {
      toast.error(unavailability.toast);
      return;
    }
    addItem(product);
    toast.success("Adicionado ao carrinho", { description: product.title });
  };

  const trustTone =
    (product.trustScore ?? 0) >= 90
      ? "text-success"
      : (product.trustScore ?? 0) >= 75
        ? "text-warning"
        : "text-muted-foreground";

  const displayImage = product.coverImage ?? product.imageUrl;

  const modelBadge = isDynamic
    ? { label: "Várias opções", tone: "bg-primary/15 text-primary" }
    : isService
      ? { label: "Serviço", tone: "bg-accent/15 text-accent" }
      : isVirtualCurrency
        ? { label: "Moeda virtual", tone: "bg-warning/15 text-warning" }
        : null;

  const priceLabel = isQuote
    ? "Sob orçamento"
    : isDynamic
      ? `A partir de ${formatBRL(product.fromPrice ?? product.price)}`
      : formatBRL(product.price);

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
          src={displayImage}
          alt={product.title}
          loading="lazy"
          className={cn(
            "h-full w-full object-cover transition-transform duration-500 group-hover:scale-110",
            !isAvailable && "grayscale-[35%] opacity-80",
          )}
        />
        <ProductBadges
          product={product}
          variant="overlay"
          className="absolute left-3 top-3 max-w-[calc(100%-4rem)]"
        />
        {product.discountPercent && isAvailable && !isDynamic && !isQuote && (
          <span className="absolute right-3 top-3 rounded-md bg-success px-2 py-0.5 text-xs font-semibold text-success-foreground shadow-card">
            -{product.discountPercent}%
          </span>
        )}
        {unavailability && (
          <span
            className={cn(
              "absolute right-3 top-3 rounded-md px-2 py-0.5 text-xs font-semibold shadow-card",
              unavailability.kind === "sold_out"
                ? "bg-destructive text-destructive-foreground"
                : "bg-warning text-warning-foreground",
            )}
          >
            {unavailability.label}
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

        {(modelBadge || product.promotionTier || product.sellerPlan) && (
          <div className="flex flex-wrap gap-1">
            {modelBadge && (
              <Badge className={cn("text-[10px] font-semibold", modelBadge.tone)} variant="secondary">
                {modelBadge.label}
              </Badge>
            )}
            {product.promotionTier && (
              <Badge variant="outline" className="text-[10px] capitalize">
                {product.promotionTier === "silver"
                  ? "Prata"
                  : product.promotionTier === "gold"
                    ? "Ouro"
                    : "Diamante"}
              </Badge>
            )}
            {product.sellerPlan === "lit_max" && (
              <Badge className="bg-gradient-to-r from-primary to-accent text-[10px] text-primary-foreground">
                LIT-MAX
              </Badge>
            )}
          </div>
        )}

        {product.seller && <SellerInfo seller={product.seller} />}

        {product.trustScore != null && (
          <div className={`flex items-center gap-1 text-[11px] ${trustTone}`}>
            <ShieldCheck className="h-3.5 w-3.5" />
            {product.trustScore}% confiança
          </div>
        )}

        <div className="mt-auto flex items-end justify-between gap-2">
          <div>
            {product.originalPrice && !isDynamic && !isQuote && (
              <div className="text-xs text-muted-foreground line-through">
                {formatBRL(product.originalPrice)}
              </div>
            )}
            <div className="text-lg font-bold text-foreground">{priceLabel}</div>
            <div className="text-[11px] text-muted-foreground">
              {isVirtualCurrency && product.virtualCurrency
                ? `${product.virtualCurrency.unit} • estoque ${formatCompact(product.virtualCurrency.availableStock)}`
                : `${formatCompact(product.soldCount)} vendidos`}
            </div>
          </div>
          {requiresPage ? (
            <Button asChild size="sm" variant="secondary">
              <Link to="/produto/$id" params={{ id: product.slug }}>
                {isQuote ? "Solicitar" : isDynamic ? "Ver opções" : "Ver oferta"}
              </Link>
            </Button>
          ) : (
            <Button
              size="icon"
              variant="default"
              aria-label={isAvailable ? "Adicionar ao carrinho" : unavailability!.label}
              onClick={handleAdd}
              disabled={!isAvailable}
              aria-disabled={!isAvailable}
              className={cn(
                "transition-transform",
                isAvailable ? "hover:scale-110" : "cursor-not-allowed opacity-60",
              )}
            >
              <ShoppingCart className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </motion.article>
  );
}
