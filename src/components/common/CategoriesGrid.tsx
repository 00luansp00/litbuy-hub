import { motion } from "motion/react";
import { CategoryCard } from "@/components/common/CategoryCard";
import { cn } from "@/lib/utils";
import type { Category } from "@/types";

type Columns = 2 | 3 | 4 | 6;

interface CategoriesGridProps {
  categories: Category[];
  columns?: Columns;
  className?: string;
}

const COLUMN_CLASS: Record<Columns, string> = {
  2: "grid-cols-2",
  3: "grid-cols-2 md:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4",
  6: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6",
};

/**
 * CategoriesGrid — grid reutilizável de CategoryCard.
 * Usado na Home e futuramente na página completa de categorias.
 */
export function CategoriesGrid({
  categories,
  columns = 6,
  className,
}: CategoriesGridProps) {
  return (
    <div className={cn("grid gap-3 md:gap-4", COLUMN_CLASS[columns], className)}>
      {categories.map((category, i) => (
        <motion.div
          key={category.id}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.35, delay: Math.min(i * 0.03, 0.3) }}
        >
          <CategoryCard category={category} />
        </motion.div>
      ))}
    </div>
  );
}
