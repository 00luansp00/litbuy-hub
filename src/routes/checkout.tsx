import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/common/PlaceholderPage";

export const Route = createFileRoute("/checkout")({
  component: () => (
    <PlaceholderPage title="Checkout" description="O fluxo de checkout está sendo cuidadosamente construído." icon="CreditCard" />
  ),
});
