import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/common/PlaceholderPage";

export const Route = createFileRoute("/perfil")({
  component: () => (
    <PlaceholderPage title="Seu perfil" description="Em breve você poderá gerenciar sua conta por aqui." icon="User" />
  ),
});
