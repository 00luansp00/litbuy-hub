import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatPublicCatalogPrice } from "@/components/public-catalog/formatPublicCatalogPrice";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/providers/AuthContext";
import type { PublicCatalogProductDetail } from "@/services/publicCatalog";
import { useAddBuyerCartItem, useBuyerSellerCart } from "@/services/cartApiHooks";

const cartErrorMessages: Record<string, string> = {
  CART_ITEM_ALREADY_EXISTS: "Este item já está no carrinho.",
  CART_SINGLE_SKU_REQUIRED:
    "Conclua ou remova o produto atual antes de comprar outro produto ou variante desta loja.",
  PRODUCT_NOT_PURCHASABLE: "Este produto não está disponível para compra.",
  SELF_PURCHASE_NOT_ALLOWED: "Você não pode comprar um produto da sua própria loja.",
  PRODUCT_VARIANT_REQUIRED: "Selecione uma variante antes de adicionar.",
  PRODUCT_VARIANT_NOT_AVAILABLE: "A variante selecionada não está disponível.",
  INSUFFICIENT_STOCK: "Não há estoque suficiente para este item.",
  PRODUCT_REQUIRES_QUOTE: "Este serviço exige orçamento antes da compra.",
  QUANTITY_UNAVAILABLE: "A quantidade solicitada não está disponível.",
  CART_MUTATION_CONFLICT: "O carrinho está sendo atualizado. Tente novamente.",
};

const isMissingCart = (error: unknown) =>
  error instanceof ApiError && error.status === 404 && error.code === "CART_NOT_FOUND";

const messageFor = (error: unknown) =>
  error instanceof ApiError
    ? (cartErrorMessages[error.code] ?? "Não foi possível adicionar o produto ao carrinho.")
    : "Não foi possível adicionar o produto ao carrinho.";

export function PublicProductPurchasePanel({ product }: { product: PublicCatalogProductDetail }) {
  const { status } = useAuth();
  const cartQuery = useBuyerSellerCart(product.seller.slug);
  const addItem = useAddBuyerCartItem();
  const [selectedVariantId, setSelectedVariantId] = useState<string>();
  const [feedback, setFeedback] = useState<string>();

  const isQuote = product.model === "SERVICE" && product.serviceDetails?.pricingType === "QUOTE";
  const noCart = cartQuery.isError && isMissingCart(cartQuery.error);
  const cartLoadFailed = cartQuery.isError && !noCart;
  const cartKnown = cartQuery.isSuccess || noCart;
  const selectedVariant = product.variants.find(({ id }) => id === selectedVariantId);
  const duplicate = cartQuery.data?.items.some(
    (item) =>
      item.product.id === product.id &&
      (product.model !== "DYNAMIC" || item.variant?.id === selectedVariantId),
  );
  const occupiedByAnotherSelection = Boolean(cartQuery.data?.items.length) && !duplicate;

  const addToCart = () => {
    if (
      status !== "authenticated" ||
      !cartKnown ||
      duplicate ||
      occupiedByAnotherSelection ||
      (product.model === "DYNAMIC" && !selectedVariant)
    )
      return;
    setFeedback(undefined);
    addItem.reset();
    addItem.mutate(
      {
        sellerSlug: product.seller.slug,
        input: {
          productId: product.id,
          ...(selectedVariant ? { productVariantId: selectedVariant.id } : {}),
          quantity: 1,
          expectedVersion: cartQuery.data?.version ?? 0,
        },
      },
      {
        onSuccess: () => {
          setFeedback("Produto adicionado ao carrinho.");
          toast.success("Produto adicionado ao carrinho");
        },
        onError: (error) => {
          if (error instanceof ApiError && error.code === "CART_VERSION_CONFLICT") {
            setFeedback("Seu carrinho mudou. Sincronizamos os dados; tente novamente.");
            void cartQuery.refetch();
            return;
          }
          setFeedback(messageFor(error));
        },
      },
    );
  };

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-5" aria-labelledby="purchase-title">
      <div>
        <h2 id="purchase-title" className="font-semibold">
          Comprar este produto
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A disponibilidade e os valores serão confirmados pelo servidor.
        </p>
      </div>

      {product.model === "DYNAMIC" && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Escolha uma variante</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {product.variants.map((variant) => {
              const unavailable = variant.stock <= 0;
              const selected = selectedVariantId === variant.id;
              return (
                <button
                  key={variant.id}
                  type="button"
                  disabled={unavailable || addItem.isPending}
                  aria-pressed={selected}
                  onClick={() => setSelectedVariantId(variant.id)}
                  className={`rounded-lg border p-3 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    selected ? "border-primary bg-primary/10 ring-1 ring-primary" : "hover:bg-muted"
                  }`}
                >
                  <span className="block font-medium">{variant.title}</span>
                  {variant.description && (
                    <span className="mt-1 block text-muted-foreground">{variant.description}</span>
                  )}
                  <span className="mt-2 block font-semibold text-primary">
                    {formatPublicCatalogPrice({ kind: "FIXED", amount: variant.price })}
                  </span>
                  <span className="text-muted-foreground">
                    {unavailable ? "Sem estoque" : `${variant.stock} em estoque`}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {status === "initializing" ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Verificando sua sessão…
        </p>
      ) : status === "anonymous" ? (
        <Button asChild className="w-full">
          <Link to="/login">Entrar para comprar</Link>
        </Button>
      ) : status !== "authenticated" ? (
        <p className="rounded-lg bg-muted p-3 text-sm">
          Conclua a autenticação da sua conta para continuar a compra.
        </p>
      ) : isQuote ? (
        <p className="rounded-lg bg-muted p-3 text-sm">
          Este serviço exige orçamento antes da compra.
        </p>
      ) : cartQuery.isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Sincronizando carrinho…
        </p>
      ) : cartLoadFailed ? (
        <div className="space-y-3" role="alert">
          <p className="text-sm text-destructive">
            Não foi possível sincronizar seu carrinho. Tente novamente antes de adicionar.
          </p>
          <Button type="button" variant="outline" onClick={() => void cartQuery.refetch()}>
            Tentar sincronizar novamente
          </Button>
        </div>
      ) : occupiedByAnotherSelection ? (
        <p className="rounded-lg bg-muted p-3 text-sm" role="status">
          Cada compra usa um produto ou variante por vez. Conclua ou remova o item atual desta loja
          antes de comprar outro.
        </p>
      ) : (
        <Button
          type="button"
          className="w-full"
          disabled={
            addItem.isPending ||
            duplicate ||
            occupiedByAnotherSelection ||
            !cartKnown ||
            (product.model === "DYNAMIC" && !selectedVariant)
          }
          onClick={addToCart}
        >
          {addItem.isPending ? (
            <>
              <Loader2 className="animate-spin" /> Adicionando…
            </>
          ) : duplicate ? (
            "Já está no carrinho"
          ) : (
            "Adicionar ao carrinho"
          )}
        </Button>
      )}

      {feedback && (
        <p className="text-sm" role="status">
          {feedback}
        </p>
      )}
    </section>
  );
}
