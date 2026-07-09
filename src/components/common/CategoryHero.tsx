import { motion } from "motion/react";
import { icons } from "lucide-react";
import { formatCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Category } from "@/types";

interface CategoryHeroProps {
  category: Category;
  className?: string;
}

/**
 * CategoryHero — cabeçalho premium para páginas de categoria.
 * Gradiente e glow derivados de `category.color`.
 */
export function CategoryHero({ category, className }: CategoryHeroProps) {
  const Icon = (icons as Record<string, React.ComponentType<{ className?: string }>>)[
    category.icon
  ];
  const color = category.color ?? "var(--primary)";
  const listings = category.listingCount ?? category.productCount;

  const style = { "--cat-color": color } as React.CSSProperties;

  return (
    <section
      style={style}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-card",
        className,
      )}
    >
      {/* Gradiente de fundo */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in oklab, var(--cat-color) 22%, transparent) 0%, transparent 55%)",
        }}
      />
      {/* Glow discreto */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl opacity-60"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--cat-color) 40%, transparent), transparent 70%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative flex flex-col gap-5 p-6 md:flex-row md:items-center md:gap-6 md:p-8"
      >
        <span
          className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl md:h-20 md:w-20"
          style={{
            backgroundColor: "color-mix(in oklab, var(--cat-color) 18%, transparent)",
            color: "var(--cat-color)",
          }}
        >
          {Icon ? <Icon className="h-8 w-8 md:h-10 md:w-10" /> : null}
        </span>

        <div className="min-w-0 flex-1 space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            {category.name}
          </h1>
          {category.description && (
            <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
              {category.description}
            </p>
          )}
          {listings != null && (
            <p className="text-xs text-muted-foreground">
              <span
                className="font-semibold"
                style={{ color: "var(--cat-color)" }}
              >
                {formatCompact(listings)}
              </span>{" "}
              anúncios ativos
            </p>
          )}
        </div>
      </motion.div>
    </section>
  );
}
