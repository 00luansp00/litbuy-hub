import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { ArrowUpRight, icons } from "lucide-react";
import type { Category } from "@/types";
import { formatCompact } from "@/lib/format";
import { cn } from "@/lib/utils";

interface CategoryCardProps {
  category: Category;
  className?: string;
}

export function CategoryCard({ category, className }: CategoryCardProps) {
  const Icon = (icons as Record<string, React.ComponentType<{ className?: string }>>)[
    category.icon
  ];
  const listings = category.listingCount ?? category.productCount;
  const color = category.color ?? "var(--primary)";

  // Estilos derivados da cor de destaque — sem hardcode no CSS.
  const style = {
    "--cat-color": color,
  } as React.CSSProperties;

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 280, damping: 22 }}
      style={style}
      className={cn("h-full", className)}
    >
      <Link
        to="/categoria/$slug"
        params={{ slug: category.slug }}
        className={cn(
          "group relative flex h-full cursor-pointer flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-card p-5",
          "transition-all duration-300 hover:border-[color:var(--cat-color)]/50 hover:shadow-elegant",
        )}
      >
        {/* Gradiente sutil no fundo */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background:
              "linear-gradient(140deg, color-mix(in oklab, var(--cat-color) 12%, transparent) 0%, transparent 55%)",
          }}
        />
        {/* Glow extremamente discreto */}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-60"
          style={{
            background:
              "radial-gradient(circle, color-mix(in oklab, var(--cat-color) 45%, transparent), transparent 70%)",
          }}
        />

        <div className="relative flex items-start justify-between">
          <span
            className="grid h-14 w-14 place-items-center rounded-xl transition-transform duration-300 group-hover:scale-110"
            style={{
              backgroundColor: "color-mix(in oklab, var(--cat-color) 18%, transparent)",
              color: "var(--cat-color)",
            }}
          >
            {Icon ? <Icon className="h-7 w-7" /> : null}
          </span>
          <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100" />
        </div>

        <div className="relative space-y-1">
          <h3 className="text-sm font-semibold text-foreground md:text-base">
            {category.name}
          </h3>
          {listings != null && (
            <p className="text-xs text-muted-foreground">
              {formatCompact(listings)} anúncios
            </p>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
