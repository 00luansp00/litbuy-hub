import { ProductCard } from "@/components/common/ProductCard";
import { SectionHeader } from "@/components/common/SectionHeader";
import type { Product } from "@/types";

interface ProductSectionProps {
  eyebrow?: string;
  title: string;
  description?: string;
  href?: string;
  actionLabel?: string;
  products: Product[];
  /** Limita a quantidade de itens exibidos. */
  count?: number;
}

/**
 * ProductSection — seção reutilizável para listar produtos na Home
 * (e futuramente em outras páginas).
 */
export function ProductSection({
  eyebrow,
  title,
  description,
  href,
  actionLabel,
  products,
  count,
}: ProductSectionProps) {
  const items = typeof count === "number" ? products.slice(0, count) : products;

  return (
    <section className="container-lit py-12 md:py-16">
      <SectionHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        href={href}
        actionLabel={actionLabel}
      />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
        {items.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}

// Alias legado — mantém compatibilidade com o componente anterior.
export { ProductSection as ProductsSection };
