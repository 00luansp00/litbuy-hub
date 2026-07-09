import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/common/PlaceholderPage";

export const Route = createFileRoute("/vendedor")({
  component: () => (
    <PlaceholderPage title="Painel do vendedor" description="A área do vendedor será liberada em breve." icon="Store" />
  ),
});
