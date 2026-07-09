import { motion } from "motion/react";
import { ProductCard } from "./ProductCard";
import { ProductSkeleton } from "./ProductSkeleton";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";

type Columns = 2 | 3 | 4 | 5 | 6;

interface ProductGridProps {
  products: Product[];
  /** Colunas máximas em telas grandes (mobile/tablet escalonam automaticamente). */
  columns?: Columns;
  /** Exibe skeletons no lugar dos cards. */
  loading?: boolean;
  /** Quantidade de skeletons a exibir quando `loading` for true. */
  skeletonCount?: number;
  className?: string;
}

const COLUMN_CLASS: Record<Columns, string> = {
  2: "grid-cols-2",
  3: "grid-cols-2 md:grid-cols-3",
  4: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
  5: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
  6: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6",
};

/**
 * ProductGrid — apenas layout dos cards. Sem lógica de negócio.
 * Reutilizado em Home, Categorias, Busca, Vendedor, Favoritos, etc.
 */
export function ProductGrid({
  products,
  columns = 4,
  loading = false,
  skeletonCount = 8,
  className,
}: ProductGridProps) {
  const gridClass = cn("grid gap-4 md:gap-5", COLUMN_CLASS[columns], className);

  if (loading) {
    return (
      <div className={gridClass}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <ProductSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className={gridClass}>
      {products.map((product, index) => (
        <motion.div
          key={product.id}
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.32) }}
        >
          <ProductCard product={product} />
        </motion.div>
      ))}
    </div>
  );
}
