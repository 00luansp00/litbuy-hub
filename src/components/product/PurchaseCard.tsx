import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Ban,
  Heart,
  MessageSquare,
  Minus,
  PackageX,
  Plus,
  Share2,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Wallet,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCart } from "@/providers/CartProvider";
import { useAuth } from "@/providers/AuthContext";
import { getUnavailabilityReason } from "@/services/productService";
import { ProductVariantSelector } from "./ProductVariantSelector";
import { VirtualCurrencyQuoteBox, computeQuote } from "./VirtualCurrencyQuoteBox";
import { MiniCartModal } from "@/components/cart/MiniCartModal";
import type {
  CartItem,
  ListingVariant,
  MiniCartItem,
  Product,
  VirtualCurrencyQuote,
} from "@/types";

interface PurchaseCardProps {
  product: Product;
  className?: string;
}

function toMiniCartItem(item: CartItem): MiniCartItem {
  return {
    key: item.key,
    productId: item.productId,
    slug: item.slug,
    title: item.title,
    image: item.image,
    quantity: item.quantity,
    unitPrice: item.price,
    subtotal: item.price * item.quantity,
    variantTitle: item.selectedVariantTitle,
    virtualCurrencyUnit: item.virtualCurrencyUnit,
  };
}

export function PurchaseCard({ product, className }: PurchaseCardProps) {
  const unavailability = getUnavailabilityReason(product);
  const isAvailable = !unavailability;
  const isDynamic = product.listingModel === "dynamic";
  const isService = product.listingModel === "service" || product.productType === "service";
  const isServiceQuote = isService && product.servicePricingType === "quote";
  const isVirtualCurrency =
    product.productType === "virtual_currency" || !!product.virtualCurrency;

  const [selectedVariant, setSelectedVariant] = useState<ListingVariant | null>(
    isDynamic && product.variants?.length ? null : null,
  );
  const [qty, setQty] = useState(1);
  const [miniOpen, setMiniOpen] = useState(false);
  const [lastAdded, setLastAdded] = useState<MiniCartItem | null>(null);

  const { addItem, itemCount, subtotal } = useCart();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const effectiveStock = selectedVariant?.stock ?? product.stock ?? 99;
  const effectivePrice = selectedVariant?.price ?? product.price;

  const maxQty = Math.max(1, Math.min(99, effectiveStock));
  const variantBlocked =
    isDynamic && (!selectedVariant || selectedVariant.stock <= 0 || selectedVariant.status === "paused");
  const canBuy = isAvailable && !variantBlocked && !isServiceQuote && !isVirtualCurrency;

  const openMini = (item: CartItem) => {
    setLastAdded(toMiniCartItem(item));
    setMiniOpen(true);
  };

  const handleAddStandard = () => {
    if (unavailability) {
      toast.error(unavailability.toast);
      return;
    }
    if (isDynamic && !selectedVariant) {
      toast.error("Selecione uma variação para continuar.");
      return;
    }
    const added = addItem(product, {
      quantity: qty,
      variant: selectedVariant ?? undefined,
    });
    if (added) openMini(added);
  };

  const handleBuyNow = () => {
    if (!canBuy) return;
    if (isDynamic && !selectedVariant) {
      toast.error("Selecione uma variação para continuar.");
      return;
    }
    const added = addItem(product, {
      quantity: qty,
      variant: selectedVariant ?? undefined,
      silent: true,
    });
    if (!added) return;
    if (!isAuthenticated) {
      toast.info("Faça login para finalizar a compra");
      navigate({ to: "/login" });
      return;
    }
    navigate({ to: "/checkout" });
  };

  const handleQuoteRequest = () => {
    toast.info("Solicitação de orçamento em modo demonstração", {
      description: "Você será direcionado ao chat com o vendedor.",
    });
    navigate({ to: "/mensagens" });
  };

  const handleVirtualCurrencyAdd = (quote: VirtualCurrencyQuote) => {
    const added = addItem(product, {
      quantity: quote.quantity,
      unitPriceOverride: quote.unitPrice,
      virtualCurrencyUnit: quote.unit,
      titleOverride: `${product.title} — ${quote.quantity.toLocaleString("pt-BR")} ${quote.unit}`,
    });
    if (added) openMini(added);
  };

  // Memo para evitar recalcular labels
  const priceLabel = useMemo(() => {
    if (isServiceQuote) return "Sob orçamento";
    if (isDynamic && !selectedVariant) {
      return `A partir de ${formatBRL(product.fromPrice ?? product.price)}`;
    }
    if (isVirtualCurrency && product.virtualCurrency) {
      const q = computeQuote(product.virtualCurrency, product.virtualCurrency.minQuantity);
      return `A partir de ${formatBRL(q.total)}`;
    }
    return formatBRL(effectivePrice);
  }, [isDynamic, isServiceQuote, isVirtualCurrency, product, selectedVariant, effectivePrice]);

  return (
    <>
      <motion.aside
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className={cn(
          "flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-card",
          className,
        )}
      >
        <div className="space-y-1">
          {product.originalPrice && !isDynamic && !isServiceQuote && !isVirtualCurrency && (
            <div className="text-xs text-muted-foreground line-through">
              {formatBRL(product.originalPrice)}
            </div>
          )}
          <div className="text-3xl font-bold text-foreground">{priceLabel}</div>
          {!isServiceQuote && !isVirtualCurrency && (
            <p className="text-xs text-muted-foreground">
              ou 12x de {formatBRL(effectivePrice / 12)} sem juros
            </p>
          )}
          {product.deliveryMode && (
            <Badge variant="secondary" className="mt-1 gap-1 text-[10px]">
              {product.deliveryMode === "automatic" ? (
                <>
                  <Zap className="h-3 w-3 text-warning" /> Entrega automática
                </>
              ) : (
                <>
                  <Truck className="h-3 w-3 text-primary" /> Entrega manual
                </>
              )}
            </Badge>
          )}
        </div>

        {unavailability && (
          <div
            className={cn(
              "flex items-start gap-2 rounded-xl border p-3 text-xs",
              unavailability.kind === "sold_out"
                ? "border-destructive/40 bg-destructive/5 text-destructive"
                : "border-warning/40 bg-warning/5 text-warning",
            )}
          >
            {unavailability.kind === "sold_out" ? (
              <PackageX className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <Ban className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <p className="font-medium">
              {unavailability.kind === "sold_out"
                ? "Produto esgotado"
                : "Produto indisponível"}
            </p>
          </div>
        )}

        {isDynamic && product.variants && product.variants.length > 0 && (
          <ProductVariantSelector
            variants={product.variants}
            selectedId={selectedVariant?.id}
            onSelect={(v) => {
              setSelectedVariant(v);
              setQty(1);
            }}
          />
        )}

        {isVirtualCurrency && product.virtualCurrency && (
          <VirtualCurrencyQuoteBox
            config={product.virtualCurrency}
            onAdd={handleVirtualCurrencyAdd}
            disabled={!isAvailable}
          />
        )}

        {isServiceQuote && (
          <div className="rounded-xl border border-primary/40 bg-primary/5 p-3 text-xs text-foreground">
            <p className="font-semibold">Serviço sob orçamento</p>
            <p className="mt-1 text-muted-foreground">
              Serviços sob orçamento exigem conversa prévia com o vendedor.
            </p>
          </div>
        )}

        {/* Quantidade — apenas para modo normal / variante dinâmica */}
        {!isServiceQuote && !isVirtualCurrency && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Quantidade</span>
            <div className="inline-flex items-center rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                aria-label="Diminuir"
                disabled={!canBuy}
                className="grid h-9 w-9 place-items-center text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-8 text-center text-sm font-medium">{qty}</span>
              <button
                type="button"
                onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                aria-label="Aumentar"
                disabled={!canBuy || qty >= maxQty}
                className="grid h-9 w-9 place-items-center text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {isServiceQuote ? (
            <Button size="lg" className="w-full" onClick={handleQuoteRequest}>
              <MessageSquare className="mr-2 h-4 w-4" /> Solicitar orçamento
            </Button>
          ) : isVirtualCurrency ? null : (
            <>
              <Button
                size="lg"
                className="w-full"
                onClick={handleBuyNow}
                disabled={!canBuy}
              >
                <Zap className="mr-2 h-4 w-4" /> Comprar agora
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="w-full"
                onClick={handleAddStandard}
                disabled={!canBuy}
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                {isService ? "Contratar serviço" : "Adicionar ao carrinho"}
              </Button>
            </>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm">
              <Heart className="mr-2 h-4 w-4" /> Favoritar
            </Button>
            <Button variant="outline" size="sm">
              <Share2 className="mr-2 h-4 w-4" /> Compartilhar
            </Button>
          </div>
        </div>

        <Separator />

        <ul className="space-y-2.5 text-xs text-muted-foreground">
          <TrustRow icon={ShieldCheck} tone="text-success">
            Garantia da plataforma LIT Buy
          </TrustRow>
          <TrustRow icon={Wallet} tone="text-accent">
            Pagamento 100% protegido
          </TrustRow>
          {product.deliveryMode === "automatic" || product.instantDelivery ? (
            <TrustRow icon={Zap} tone="text-warning">
              Entrega automática após pagamento aprovado
            </TrustRow>
          ) : (
            <TrustRow icon={Truck} tone="text-primary">
              Entrega manual — vendedor envia após confirmação
            </TrustRow>
          )}
        </ul>
      </motion.aside>

      <MiniCartModal
        open={miniOpen}
        onClose={() => setMiniOpen(false)}
        item={lastAdded}
        cartCount={itemCount}
        cartSubtotal={subtotal}
      />
    </>
  );
}

function TrustRow({
  icon: Icon,
  tone,
  children,
}: {
  icon: typeof ShieldCheck;
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2">
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone)} />
      <span>{children}</span>
    </li>
  );
}
