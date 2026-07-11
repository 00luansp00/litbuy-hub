import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
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
import { useCart } from "@/providers/CartProvider";
import { useAuth } from "@/providers/AuthProvider";
import { checkoutService } from "@/services/checkoutService";
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
  const { items, summary, coupon, clearCart } = useCart();
  const { user } = useAuth();
  const [selected, setSelected] = useState<PaymentMethodId | undefined>();
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<MockOrder | null>(null);

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
            loading={loading}
          />
        </aside>
      </div>
    </CheckoutLayout>
  );
}
