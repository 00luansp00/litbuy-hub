import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ApiError } from "@/lib/api/client";
import {
  useBuyerSellerCart,
  useRemoveBuyerCartItem,
  useUpdateBuyerCartItem,
} from "@/services/cartApiHooks";
import type { BuyerCart } from "@/services/cartApiService";
import { BuyerCartItemCard } from "./BuyerCartItemCard";
import { formatBrlMinorUnits } from "./formatMinorUnits";

const errorMessages: Record<string, string> = {
  CART_ITEM_NOT_FOUND: "Este item não está mais no carrinho. Sincronize e tente novamente.",
  CART_MUTATION_CONFLICT: "O carrinho está sendo atualizado. Tente novamente.",
  PRODUCT_NOT_PURCHASABLE: "Este produto não está disponível para compra.",
  PRODUCT_VARIANT_NOT_AVAILABLE: "A variante selecionada não está disponível.",
  INSUFFICIENT_STOCK: "Não há estoque suficiente para esta quantidade.",
  QUANTITY_UNAVAILABLE: "A quantidade solicitada não está disponível.",
};

const messageFor = (error: unknown) =>
  error instanceof ApiError
    ? (errorMessages[error.code] ?? "Não foi possível atualizar este carrinho.")
    : "Não foi possível atualizar este carrinho.";

export function BuyerCartSellerSection({ cart: listedCart }: { cart: BuyerCart }) {
  const synchronizedCart = useBuyerSellerCart(listedCart.seller.slug, false);
  const synchronized = synchronizedCart.data;
  const cart =
    synchronized && synchronized.id === listedCart.id && synchronized.version > listedCart.version
      ? synchronized
      : listedCart;
  const updateItem = useUpdateBuyerCartItem();
  const removeItem = useRemoveBuyerCartItem();
  const [feedback, setFeedback] = useState<string>();
  const pending = updateItem.isPending || removeItem.isPending;
  const hasSingleLine = cart.items.length === 1;

  const handleError = async (error: unknown) => {
    if (error instanceof ApiError && error.code === "CART_VERSION_CONFLICT") {
      setFeedback("Seu carrinho mudou. Sincronizamos os dados; revise e tente novamente.");
      await synchronizedCart.refetch();
      return;
    }
    setFeedback(messageFor(error));
  };

  const changeQuantity = (itemId: string, quantity: number) => {
    if (pending || quantity < 1 || quantity > 999) return;
    setFeedback(undefined);
    updateItem.mutate(
      {
        sellerSlug: cart.seller.slug,
        itemId,
        input: { quantity, expectedVersion: cart.version },
      },
      {
        onSuccess: () => setFeedback("Quantidade atualizada."),
        onError: (error) => void handleError(error),
      },
    );
  };

  const remove = (itemId: string) => {
    if (pending) return;
    setFeedback(undefined);
    removeItem.mutate(
      {
        sellerSlug: cart.seller.slug,
        itemId,
        input: { expectedVersion: cart.version },
      },
      {
        onSuccess: () => setFeedback("Item removido do carrinho."),
        onError: (error) => void handleError(error),
      },
    );
  };

  return (
    <section
      className="space-y-4 rounded-2xl border bg-background p-4 md:p-6"
      aria-labelledby={`seller-${cart.id}`}
      data-testid={`seller-cart-${cart.seller.slug}`}
    >
      <header className="flex flex-col justify-between gap-2 border-b pb-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Carrinho da loja
          </p>
          <h2 id={`seller-${cart.id}`} className="text-xl font-semibold">
            {cart.seller.storeName}
          </h2>
          <Link
            to="/loja/$slug"
            params={{ slug: cart.seller.slug }}
            className="text-xs text-muted-foreground hover:text-primary hover:underline"
          >
            @{cart.seller.slug}
          </Link>
        </div>
        <p className="text-sm font-medium">
          {cart.checkoutReady && hasSingleLine ? "Pronto para checkout" : "Precisa de ajustes"}
        </p>
      </header>

      {cart.items.length === 0 ? (
        <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
          Este carrinho está ativo, mas não possui itens.
        </p>
      ) : (
        <div className="space-y-3">
          {cart.items.map((item) => (
            <BuyerCartItemCard
              key={item.id}
              item={item}
              disabled={pending}
              onQuantityChange={(quantity) => changeQuantity(item.id, quantity)}
              onRemove={() => remove(item.id)}
            />
          ))}
        </div>
      )}

      {feedback && (
        <p className="text-sm" role="status">
          {feedback}
        </p>
      )}

      <footer className="flex flex-col justify-between gap-3 border-t pt-4 sm:flex-row sm:items-end">
        <div>
          {hasSingleLine && cart.checkoutReady ? (
            <Link
              to="/checkout"
              search={{ sellerSlug: cart.seller.slug }}
              className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Ir para checkout
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground">
              {cart.items.length > 1
                ? "Este carrinho possui uma seleção inválida. Remova os itens excedentes para continuar."
                : "Ajuste os itens deste carrinho para continuar."}
            </p>
          )}
        </div>
        <div className="sm:text-right">
          <p className="text-xs text-muted-foreground">Subtotal de {cart.seller.storeName}</p>
          <p className="text-xl font-bold" data-testid={`subtotal-${cart.seller.slug}`}>
            {cart.previewSubtotalMinor === null
              ? "Valor não disponível"
              : formatBrlMinorUnits(cart.previewSubtotalMinor)}
          </p>
        </div>
      </footer>
    </section>
  );
}
