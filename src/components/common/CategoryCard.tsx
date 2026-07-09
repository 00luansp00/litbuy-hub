import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { icons } from "lucide-react";
import type { Category } from "@/types";
import { formatCompact } from "@/lib/format";

interface CategoryCardProps {
  category: Category;
}

export function CategoryCard({ category }: CategoryCardProps) {
  const Icon = (icons as Record<string, React.ComponentType<{ className?: string }>>)[
    category.icon
  ];

  return (
    <motion.div whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 280 }}>
      <Link
        to="/categoria/$slug"
        params={{ slug: category.slug }}
        className="group relative flex flex-col items-start gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50 hover:bg-surface"
      >
        <span
          className="grid h-11 w-11 place-items-center rounded-lg text-primary transition-transform group-hover:scale-110"
          style={{
            backgroundColor: "color-mix(in oklab, var(--primary) 15%, transparent)",
          }}
        >
          {Icon ? <Icon className="h-5 w-5" /> : null}
        </span>
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold text-foreground">{category.name}</h3>
          {category.productCount != null && (
            <p className="text-xs text-muted-foreground">
              {formatCompact(category.productCount)} produtos
            </p>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
