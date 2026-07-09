import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/common/PlaceholderPage";

export const Route = createFileRoute("/mensagens")({
  component: () => (
    <PlaceholderPage title="Mensagens" description="O centro de mensagens será liberado nas próximas etapas." icon="MessageSquare" />
  ),
});
