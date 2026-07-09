import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/common/PlaceholderPage";

export const Route = createFileRoute("/pedidos")({
  component: () => (
    <PlaceholderPage title="Meus pedidos" description="Acompanhamento de pedidos em desenvolvimento." icon="ClipboardList" />
  ),
});
