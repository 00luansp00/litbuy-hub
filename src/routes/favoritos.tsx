import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/common/PlaceholderPage";

export const Route = createFileRoute("/favoritos")({
  component: () => (
    <PlaceholderPage title="Favoritos" description="Sua lista de favoritos estará disponível em breve." icon="Heart" />
  ),
});
