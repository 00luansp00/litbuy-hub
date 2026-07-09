import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/common/PlaceholderPage";

export const Route = createFileRoute("/produto/$id")({
  component: ProductPage,
});

function ProductPage() {
  const { id } = Route.useParams();
  return (
    <PlaceholderPage
      title="Página do produto"
      description={`A página detalhada do produto "${id}" está em construção.`}
      icon="Package"
    />
  );
}
