import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { AuthGate } from "@/components/auth/AuthGate";
import { CheckoutLayout } from "@/components/checkout/CheckoutLayout";
import { CheckoutItemsReview } from "@/components/checkout/CheckoutItemsReview";
import { CheckoutBuyerCard } from "@/components/checkout/CheckoutBuyerCard";
import { CheckoutPaymentMethods } from "@/components/checkout/CheckoutPaymentMethods";
import { CheckoutSummaryCard } from "@/components/checkout/CheckoutSummaryCard";
import { CheckoutSecurityNotice } from "@/components/checkout/CheckoutSecurityNotice";
import { CheckoutSuccess } from "@/components/checkout/CheckoutSuccess";
import { EmptyCheckoutState } from "@/components/checkout/EmptyCheckoutState";
import { Button } from "@/components/ui/button";
import { useCart } from "@/providers/CartProvider";
import { useAuth } from "@/providers/AuthProvider";
import { checkoutService } from "@/services/checkoutService";
import { cartService } from "@/services/cartService";
import type { CheckoutStep, MockOrder, PaymentMethodId } from "@/types";



export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
});

function CheckoutPage() {
  return (
    <AuthGate
      title="Entre para finalizar a compra"
      description="Você precisa estar logado na LIT Buy para concluir o checkout. Faça login ou crie sua conta em segundos."
    >
      <CheckoutContent />
    </AuthGate>
  );
}

function CheckoutContent() {
  const { items, summary, coupon, clearCart, removeItem } = useCart();
  const { user } = useAuth();
  const [selected, setSelected] = useState<PaymentMethodId | undefined>();
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<MockOrder | null>(null);

  // Detecta itens que ficaram indisponíveis via cartService — bloqueia
  // finalização se algum produto virou "paused"/"esgotado" em memória.
  const unavailableItems = useMemo(
    () => cartService.findUnavailableItems(items),
    [items],
  );
  const hasUnavailable = unavailableItems.length > 0;


  const methods = useMemo(() => checkoutService.getPaymentMethods(), []);

  const buyer = useMemo(
    () =>
      checkoutService.getBuyerMockProfile(
        user
          ? { name: user.name, email: user.email }
          : undefined,
      ),
    [user],
  );

  const selectedMethod = selected
    ? checkoutService.getPaymentMethod(selected)
    : undefined;

  const step: CheckoutStep = order
    ? "success"
    : selected
      ? "payment"
      : "review";

  const handleSelect = (id: PaymentMethodId) => {
    setSelected(id);
    const m = checkoutService.getPaymentMethod(id);
    if (m) toast.success(`Método selecionado: ${m.label}`);
  };

  const handleConfirm = async () => {
    if (items.length === 0) {
      toast.error("Seu carrinho está vazio.");
      return;
    }
    if (hasUnavailable) {
      toast.error("Remova os itens indisponíveis antes de finalizar.");
      return;
    }
    if (!selected) {
      toast.error("Selecione um método de pagamento para continuar.");
      return;
    }
    setLoading(true);
    try {
      const newOrder = await checkoutService.simulateOrderCreation({
        buyer,
        paymentMethodId: selected,
        items,
        summary,
      });
      setOrder(newOrder);
      clearCart();
      toast.success("Pedido mockado criado com sucesso!");
    } finally {
      setLoading(false);
    }
  };


  if (order) {
    return (
      <CheckoutLayout step="success" subtitle="Seu pedido de demonstração foi gerado.">
        <CheckoutSuccess order={order} />
      </CheckoutLayout>
    );
  }

  if (items.length === 0) {
    return (
      <CheckoutLayout step="review">
        <EmptyCheckoutState />
      </CheckoutLayout>
    );
  }

  return (
    <CheckoutLayout step={step}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          {hasUnavailable && (
            <div className="flex flex-col gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="space-y-1">
                  <p className="font-semibold">
                    Alguns itens do seu carrinho ficaram indisponíveis
                  </p>
                  <p className="text-xs text-destructive/80">
                    Remova os itens abaixo para continuar. A finalização mockada
                    está bloqueada enquanto houver produtos indisponíveis.
                  </p>
                </div>
              </div>
              <ul className="space-y-2">
                {unavailableItems.map(({ item, reason }) => (
                  <li
                    key={item.key}
                    className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-background/40 p-2 text-xs"
                  >
                    <span className="truncate text-foreground">
                      {item.title}{" "}
                      <span className="text-destructive/80">
                        — {reason.label}
                      </span>
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        removeItem(item.key);
                        toast.success("Item removido do carrinho.");
                      }}
                    >
                      Remover
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <CheckoutItemsReview items={items} />
          <CheckoutBuyerCard buyer={buyer} />
          <CheckoutPaymentMethods
            methods={methods}
            selected={selected}
            onSelect={handleSelect}
          />
          <CheckoutSecurityNotice />
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <CheckoutSummaryCard
            summary={summary}
            items={items}
            coupon={coupon}
            paymentMethod={selectedMethod}
            onConfirm={handleConfirm}
            loading={loading || hasUnavailable}
          />
        </aside>
      </div>
    </CheckoutLayout>
  );
}

