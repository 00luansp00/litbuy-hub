import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AuthGate } from "@/components/auth/AuthGate";
import { CheckoutLayout } from "@/components/checkout/CheckoutLayout";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { buyerCartKeys, useBuyerSellerCart } from "@/services/cartApiHooks";
import { checkoutIntentKey, useCreateCheckoutSession } from "@/services/checkoutApiHooks";
import { buyerOrderKeys } from "@/services/orders";
import { formatBrlMinorUnits } from "@/components/cart/formatMinorUnits";

const SELLER_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
type CheckoutSearch = { sellerSlug?: string };

export const Route = createFileRoute("/checkout")({
  validateSearch: (search: Record<string, unknown>): CheckoutSearch => ({
    sellerSlug:
      typeof search.sellerSlug === "string" && SELLER_SLUG.test(search.sellerSlug)
        ? search.sellerSlug
        : undefined,
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { sellerSlug } = Route.useSearch();
  return (
    <AuthGate
      title="Entre para finalizar a compra"
      description="Entre como Buyer para criar o pedido."
    >
      {sellerSlug ? <CheckoutContent sellerSlug={sellerSlug} /> : <ChooseCart />}
    </AuthGate>
  );
}

function ChooseCart() {
  return (
    <CheckoutLayout step="review">
      <div className="mx-auto max-w-lg rounded-2xl border p-8 text-center">
        <h2 className="text-xl font-semibold">Escolha um carrinho para continuar</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          O checkout é feito separadamente para cada loja.
        </p>
        <Button asChild className="mt-5">
          <Link to="/carrinho">Voltar ao carrinho</Link>
        </Button>
      </div>
    </CheckoutLayout>
  );
}

const errorMessages: Record<string, string> = {
  CART_VERSION_CONFLICT: "Seu carrinho mudou. Sincronizamos os dados; revise e confirme novamente.",
  CHECKOUT_PREVIEW_CHANGED:
    "O preço ou a seleção mudou. Revise o carrinho atualizado e confirme novamente.",
  CART_NOT_CHECKOUT_READY: "Este carrinho necessita de ajustes antes do checkout.",
  CART_EMPTY: "Este carrinho está vazio.",
  INSUFFICIENT_STOCK: "O estoque mudou. Revise as quantidades antes de tentar novamente.",
  PRODUCT_REQUIRES_QUOTE: "Um item requer orçamento e não pode seguir pelo checkout.",
  CHECKOUT_CONFLICT:
    "Houve conflito ao criar o pedido. Confira seus pedidos antes de tentar novamente.",
  IDEMPOTENCY_KEY_REUSED:
    "Esta tentativa não corresponde mais ao carrinho atual. Revise e tente novamente.",
};
const refetchCodes = new Set([
  "CART_VERSION_CONFLICT",
  "CHECKOUT_PREVIEW_CHANGED",
  "CART_NOT_CHECKOUT_READY",
  "CART_EMPTY",
  "INSUFFICIENT_STOCK",
  "PRODUCT_REQUIRES_QUOTE",
]);
const money = (value: string | null) =>
  value === null ? "Valor indisponível" : formatBrlMinorUnits(value);

export function CheckoutContent({ sellerSlug }: { sellerSlug: string }) {
  const cartQuery = useBuyerSellerCart(sellerSlug);
  const create = useCreateCheckoutSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState<string>();
  const cart = cartQuery.data;

  const confirm = () => {
    if (!cart || !cart.checkoutReady || cart.items.length === 0 || create.isPending) return;
    setFeedback(undefined);
    create.mutate(
      {
        sellerSlug: cart.seller.slug,
        expectedCartVersion: cart.version,
        expectedPreviewFingerprint: cart.previewFingerprint,
        idempotencyKey: checkoutIntentKey(cart.seller.slug, cart.version, cart.previewFingerprint),
      },
      {
        onSuccess: async (order) => {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: buyerCartKeys.all }),
            queryClient.invalidateQueries({ queryKey: buyerOrderKeys.all }),
            queryClient.invalidateQueries({ queryKey: buyerOrderKeys.detail(order.orderCode) }),
          ]);
          navigate({ to: "/pedidos/$id", params: { id: order.orderCode } });
        },
        onError: (error) => {
          const code = error instanceof ApiError ? error.code : "UNKNOWN";
          setFeedback(errorMessages[code] ?? "Não foi possível criar o pedido. Tente novamente.");
          if (refetchCodes.has(code)) void cartQuery.refetch();
        },
      },
    );
  };

  if (cartQuery.isPending)
    return (
      <CheckoutLayout step="review">
        <p role="status">Carregando carrinho…</p>
      </CheckoutLayout>
    );
  if (cartQuery.isError || !cart)
    return (
      <CheckoutLayout step="review">
        <div role="alert">
          Não foi possível carregar este carrinho.{" "}
          <Link to="/carrinho" className="underline">
            Voltar ao carrinho
          </Link>
        </div>
      </CheckoutLayout>
    );
  if (cart.items.length === 0)
    return (
      <CheckoutLayout step="review">
        <div>
          Este carrinho está vazio.{" "}
          <Link to="/carrinho" className="underline">
            Editar carrinho
          </Link>
        </div>
      </CheckoutLayout>
    );

  return (
    <CheckoutLayout step="review">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-4" aria-labelledby="checkout-seller">
          <div>
            <p className="text-sm text-muted-foreground">Carrinho da loja</p>
            <h2 id="checkout-seller" className="text-2xl font-semibold">
              {cart.seller.storeName}
            </h2>
          </div>
          {cart.items.map((item) => (
            <article key={item.id} className="rounded-xl border p-4">
              <div className="flex justify-between gap-4">
                <div>
                  <h3 className="font-semibold">{item.product.title}</h3>
                  {item.variant && (
                    <p className="text-sm text-muted-foreground">Variante: {item.variant.title}</p>
                  )}
                  <p className="text-sm">Quantidade: {item.quantity}</p>
                </div>
                <div className="text-right">
                  <p>{money(item.currentLineAmountMinor)}</p>
                  <p className="text-xs text-muted-foreground">
                    {money(item.currentUnitAmountMinor)} por unidade
                  </p>
                </div>
              </div>
              {item.issues.length > 0 && (
                <div role="alert" className="mt-3 rounded-lg bg-destructive/5 p-3">
                  <p className="font-medium">Este item precisa de atenção.</p>
                  <ul className="list-inside list-disc text-sm">
                    {item.issues.map((issue) => (
                      <li key={issue}>{issue.replaceAll("_", " ")}</li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          ))}
          <Link to="/carrinho" className="text-sm underline">
            Editar carrinho
          </Link>
        </section>
        <aside className="h-fit rounded-xl border p-5">
          <p className="text-sm text-muted-foreground">Subtotal previsto</p>
          <p className="text-2xl font-bold">{money(cart.previewSubtotalMinor)}</p>
          <p className="mt-3 text-sm">
            {cart.checkoutReady ? "Pronto para checkout" : "Este carrinho necessita de ajustes."}
          </p>
          {feedback && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {feedback}
            </p>
          )}
          {feedback?.includes("Confira seus pedidos") && (
            <Link to="/pedidos" className="mt-2 block text-sm underline">
              Conferir pedidos
            </Link>
          )}
          <Button
            className="mt-5 w-full"
            disabled={!cart.checkoutReady || create.isPending}
            onClick={confirm}
          >
            {create.isPending ? "Criando pedido…" : "Confirmar e criar pedido"}
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">
            O pedido será criado com pagamento pendente. Nenhuma cobrança é feita nesta etapa.
          </p>
        </aside>
      </div>
    </CheckoutLayout>
  );
}
