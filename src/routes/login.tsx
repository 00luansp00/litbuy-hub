import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/common/PlaceholderPage";

export const Route = createFileRoute("/login")({
  component: () => (
    <PlaceholderPage
      title="Entrar na LIT Buy"
      description="A tela de login está sendo desenhada para oferecer a experiência mais segura e fluida possível."
      icon="LogIn"
    />
  ),
});
