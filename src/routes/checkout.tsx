import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { AuthGate } from "@/components/auth/AuthGate";
import { CheckoutLayout } from "@/components/checkout/CheckoutLayout";
import { CheckoutItemsReview } from "@/components/checkout/CheckoutItemsReview";
import { CheckoutBuyerCard } from "@/components/checkout/CheckoutBuyerCard";
import { CheckoutPaymentMethods } from "@/components/checkout/CheckoutPaymentMethods";
import { CheckoutProtectionPlanSection } from "@/components/checkout/CheckoutProtectionPlanSection";
import { CheckoutLitPointsCard } from "@/components/checkout/CheckoutLitPointsCard";
import { PaymentMethodBlock } from "@/components/checkout/PaymentMethodBlock";
import { CheckoutSummaryCard } from "@/components/checkout/CheckoutSummaryCard";
import { CheckoutSecurityNotice } from "@/components/checkout/CheckoutSecurityNotice";
import { EmptyCheckoutState } from "@/components/checkout/EmptyCheckoutState";
import { Button } from "@/components/ui/button";
import { useCart } from "@/providers/CartProvider";
import { useAuth } from "@/providers/AuthContext";
import { checkoutService } from "@/services/checkoutService";
import { paymentService } from "@/services/paymentService";
import { cartService } from "@/services/cartService";
import { analyticsService } from "@/services/analyticsService";
import { products as allProducts } from "@/data/products";
import type { CheckoutProtectionPlanId, CheckoutStep, PaymentMethodId } from "@/types";

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
});

function CheckoutPage() {
  return (
    <AuthGate
      title="Entre para finalizar a compra"
      description="Você precisa estar logado na LIT Buy para concluir o checkout."
    >
      <CheckoutContent />
    </AuthGate>
  );
}

function CheckoutContent() {
  const { items, summary, coupon, clearCart, removeItem } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [selected, setSelected] = useState<PaymentMethodId | undefined>();
  const [protectionId, setProtectionId] =
    useState<CheckoutProtectionPlanId>("standard");
  const [loading, setLoading] = useState(false);

  // ------------------------------------------------------------------
  // Bloqueios
  // ------------------------------------------------------------------
  const unavailableItems = useMemo(
    () => cartService.findUnavailableItems(items),
    [items],
  );
  const hasUnavailable = unavailableItems.length > 0;

  // Serviço sob orçamento não pode ir para checkout.
  const quoteOnlyItems = useMemo(() => {
    return items.filter((it) => {
      const p = allProducts.find((pp) => pp.id === it.productId);
      return (
        p?.listingModel === "service" && p?.servicePricingType === "quote"
      );
    });
  }, [items]);
  const hasQuoteOnly = quoteOnlyItems.length > 0;

  const hasAccountProduct = useMemo(
    () =>
      items.some((it) => {
        const p = allProducts.find((pp) => pp.id === it.productId);
        return p?.productType === "account";
      }),
    [items],
  );

  // ------------------------------------------------------------------
  // Serviços
  // ------------------------------------------------------------------
  const methods = useMemo(() => paymentService.getPaymentMethods(), []);
  const plans = useMemo(() => paymentService.getProtectionPlans(), []);
  const wallet = paymentService.getMockWalletBalance();

  const buyer = useMemo(
    () => ({
      ...checkoutService.getBuyerMockProfile(
        user ? { name: user.name, email: user.email } : undefined,
      ),
      maskedTaxId: "***.***.***-00",
    }),
    [user],
  );

  const protectionEnabled = protectionId === "lit_protection";
  const paySummary = useMemo(
    () => paymentService.buildPaymentSummary(summary, selected, protectionEnabled),
    [summary, selected, protectionEnabled],
  );
  const litPointsPreview = useMemo(
    () =>
      paymentService.buildLitPointsPreview(paySummary.total, protectionEnabled),
    [paySummary.total, protectionEnabled],
  );

  const selectedMethod = selected
    ? paymentService.getPaymentMethod(selected)
    : undefined;

  const step: CheckoutStep = selected ? "payment" : "review";

  const handleSelect = (id: PaymentMethodId) => {
    setSelected(id);
    const m = paymentService.getPaymentMethod(id);
    if (m) toast.success(`Método selecionado: ${m.label}`);
    analyticsService.track("select_payment_method", { method: id });
  };

  const handleSelectProtection = (id: CheckoutProtectionPlanId) => {
    setProtectionId(id);
    analyticsService.track("add_protection_plan", { plan: id });
  };

  const handleGeneratePayment = async () => {
    if (items.length === 0) {
      toast.error("Seu carrinho está vazio.");
      return;
    }
    if (hasUnavailable) {
      toast.error("Remova os itens indisponíveis antes de finalizar.");
      return;
    }
    if (hasQuoteOnly) {
      toast.error(
        "Serviço sob orçamento não pode ser finalizado no checkout. Fale com o vendedor.",
      );
      return;
    }
    if (!selected) {
      toast.error("Selecione um método de pagamento para continuar.");
      return;
    }
    setLoading(true);
    try {
      analyticsService.track("generate_payment", {
        method: selected,
        protection: protectionEnabled,
        total: paySummary.total,
      });
      const intent = await paymentService.simulateCreatePayment({
        items,
        cartSummary: summary,
        buyer,
        method: selected,
        protectionEnabled,
      });
      analyticsService.track("purchase_mocked", { paymentId: intent.id });
      clearCart();
      toast.success("Pagamento demonstrativo gerado.");
      navigate({ to: "/pagamento/$id", params: { id: intent.id } });
    } catch (err) {
      toast.error("Falha ao gerar pagamento demonstrativo.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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
          {hasQuoteOnly && (
            <BlockingNotice
              title="Serviço sob orçamento no carrinho"
              description="Serviços sob orçamento não podem ser finalizados no checkout. Fale com o vendedor para receber uma proposta."
              items={quoteOnlyItems.map((i) => ({ key: i.key, title: i.title }))}
              onRemove={(key) => {
                removeItem(key);
                toast.success("Item removido do carrinho.");
              }}
            />
          )}

          {hasUnavailable && (
            <BlockingNotice
              title="Alguns itens ficaram indisponíveis"
              description="Remova os itens abaixo para continuar."
              items={unavailableItems.map(({ item, reason }) => ({
                key: item.key,
                title: `${item.title} — ${reason.label}`,
              }))}
              onRemove={(key) => {
                removeItem(key);
                toast.success("Item removido do carrinho.");
              }}
            />
          )}

          <CheckoutItemsReview items={items} />
          <CheckoutBuyerCard buyer={buyer} />

          <CheckoutProtectionPlanSection
            plans={plans}
            selected={protectionId}
            onSelect={handleSelectProtection}
            highlightAccount={hasAccountProduct}
          />

          <CheckoutLitPointsCard
            preview={litPointsPreview}
            protectionEnabled={protectionEnabled}
          />

          <CheckoutPaymentMethods
            methods={methods}
            selected={selected}
            onSelect={handleSelect}
          />

          {selected && (
            <PaymentMethodBlock
              method={selected}
              buyer={buyer}
              total={paySummary.total}
              walletBalance={wallet}
              litPoints={litPointsPreview}
              loading={loading}
              onGenerate={handleGeneratePayment}
            />
          )}

          <CheckoutSecurityNotice />
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <CheckoutSummaryCard
            summary={{
              ...summary,
              paymentMethodId: selected,
              protectionFee: paySummary.protectionFee,
              operationalFee: paySummary.operationalFee,
              litPointsEarned: paySummary.litPointsEarned,
              total: paySummary.total,
            }}
            items={items}
            coupon={coupon}
            paymentMethod={selectedMethod}
            protectionEnabled={protectionEnabled}
            onConfirm={handleGeneratePayment}
            loading={loading || hasUnavailable || hasQuoteOnly}
          />
        </aside>
      </div>
    </CheckoutLayout>
  );
}

function BlockingNotice({
  title,
  description,
  items,
  onRemove,
}: {
  title: string;
  description: string;
  items: { key: string; title: string }[];
  onRemove: (key: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="space-y-1">
          <p className="font-semibold">{title}</p>
          <p className="text-xs text-destructive/80">{description}</p>
        </div>
      </div>
      <ul className="space-y-2">
        {items.map((it) => (
          <li
            key={it.key}
            className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-background/40 p-2 text-xs"
          >
            <span className="truncate text-foreground">{it.title}</span>
            <Button size="sm" variant="outline" onClick={() => onRemove(it.key)}>
              Remover
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
