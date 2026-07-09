import { motion } from "motion/react";
import { Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatCompact } from "@/lib/format";
import type { Review } from "@/types";

interface ProductReviewsProps {
  reviews: Review[];
  average: number;
  total: number;
  className?: string;
}

function Stars({ value, size = "sm" }: { value: number; size?: "sm" | "md" }) {
  const dim = size === "md" ? "h-4 w-4" : "h-3 w-3";
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            dim,
            i <= Math.round(value) ? "fill-warning text-warning" : "text-muted-foreground/40",
          )}
        />
      ))}
    </span>
  );
}

/**
 * ProductReviews — média, distribuição e lista de avaliações.
 * Recebe dados prontos vindos do reviewService.
 */
export function ProductReviews({ reviews, average, total, className }: ProductReviewsProps) {
  // Distribuição mockada a partir das reviews atuais (5..1).
  const dist = [5, 4, 3, 2, 1].map((star) => {
    const count = reviews.filter((r) => Math.round(r.rating) === star).length;
    const pct = reviews.length ? (count / reviews.length) * 100 : 0;
    return { star, count, pct };
  });

  return (
    <section className={cn("rounded-2xl border border-border bg-card p-5 md:p-6", className)}>
      <h2 className="mb-5 text-lg font-semibold text-foreground">Avaliações</h2>

      <div className="grid gap-6 md:grid-cols-[auto_minmax(0,1fr)] md:gap-8">
        <div className="text-center md:text-left">
          <div className="text-4xl font-bold text-foreground">{average.toFixed(1)}</div>
          <Stars value={average} size="md" />
          <p className="mt-1 text-xs text-muted-foreground">
            {formatCompact(total)} avaliações
          </p>
        </div>
        <div className="space-y-2">
          {dist.map(({ star, pct, count }) => (
            <div key={star} className="flex items-center gap-3 text-xs">
              <span className="w-8 shrink-0 text-muted-foreground">{star}★</span>
              <Progress value={pct} className="h-2 flex-1" />
              <span className="w-8 shrink-0 text-right text-muted-foreground">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <ul className="mt-6 space-y-4 border-t border-border pt-6">
        {reviews.map((r, i) => (
          <motion.li
            key={r.id}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.24) }}
            className="flex gap-3"
          >
            <Avatar className="h-9 w-9 border border-border">
              {r.avatarUrl && <AvatarImage src={r.avatarUrl} alt={r.author} />}
              <AvatarFallback className="text-xs">
                {r.author.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-foreground">{r.author}</span>
                <Stars value={r.rating} />
                <span className="text-[11px] text-muted-foreground">
                  {new Date(r.date).toLocaleDateString("pt-BR")}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{r.comment}</p>
            </div>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}
