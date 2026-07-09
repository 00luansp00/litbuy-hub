import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/common/PlaceholderPage";

export const Route = createFileRoute("/admin")({
  component: () => (
    <PlaceholderPage title="Administração" description="O painel administrativo está em desenvolvimento." icon="ShieldCheck" />
  ),
});
