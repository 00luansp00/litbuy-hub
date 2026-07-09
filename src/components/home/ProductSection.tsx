import { ProductGrid } from "@/components/common/ProductGrid";
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
  /** Colunas máximas do grid. */
  columns?: 2 | 3 | 4 | 5 | 6;
  loading?: boolean;
}

/**
 * ProductSection — combina SectionHeader + ProductGrid.
 * Continua sendo a forma padrão de listar produtos na Home.
 */
export function ProductSection({
  eyebrow,
  title,
  description,
  href,
  actionLabel,
  products,
  count,
  columns = 4,
  loading = false,
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
      <ProductGrid
        products={items}
        columns={columns}
        loading={loading}
        skeletonCount={count ?? 8}
      />
    </section>
  );
}

// Alias legado — mantém compatibilidade com o componente anterior.
export { ProductSection as ProductsSection };
