import { ProductCard } from "@/components/common/ProductCard";
import { SectionTitle } from "@/components/common/SectionTitle";
import type { Product } from "@/types";

interface ProductsSectionProps {
  eyebrow?: string;
  title: string;
  description?: string;
  href?: string;
  products: Product[];
}

export function ProductsSection({
  eyebrow,
  title,
  description,
  href,
  products,
}: ProductsSectionProps) {
  return (
    <section className="container-lit py-14">
      <SectionTitle
        eyebrow={eyebrow}
        title={title}
        description={description}
        href={href}
      />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
