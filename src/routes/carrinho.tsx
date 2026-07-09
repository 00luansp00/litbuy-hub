import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/common/PlaceholderPage";

export const Route = createFileRoute("/carrinho")({
  component: () => (
    <PlaceholderPage title="Seu carrinho" description="O carrinho de compras estará disponível em breve." icon="ShoppingCart" />
  ),
});
