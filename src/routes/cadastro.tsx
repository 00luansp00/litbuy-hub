import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/common/PlaceholderPage";

export const Route = createFileRoute("/cadastro")({
  component: () => (
    <PlaceholderPage
      title="Criar sua conta"
      description="Em breve você poderá criar sua conta LIT Buy em poucos passos."
      icon="UserPlus"
    />
  ),
});
