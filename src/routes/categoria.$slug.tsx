import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/common/PlaceholderPage";
import { categories } from "@/data/categories";

export const Route = createFileRoute("/categoria/$slug")({
  component: CategoryPage,
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const category = categories.find((c) => c.slug === slug);
  return (
    <PlaceholderPage
      title={category ? `Categoria: ${category.name}` : "Categoria"}
      description="A listagem completa desta categoria está sendo construída."
      icon="LayoutGrid"
    />
  );
}
