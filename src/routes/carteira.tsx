import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/common/PlaceholderPage";

export const Route = createFileRoute("/carteira")({
  component: () => (
    <PlaceholderPage title="Sua carteira" description="A carteira LIT Buy está em construção." icon="Wallet" />
  ),
});
