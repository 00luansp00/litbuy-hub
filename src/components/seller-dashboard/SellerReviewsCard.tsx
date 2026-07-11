import { motion } from "motion/react";
import { Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/EmptyState";
import { cn } from "@/lib/utils";
import type { SellerReview } from "@/types";

interface SellerReviewsCardProps {
  reviews: SellerReview[];
  title?: string;
}

export function SellerReviewsCard({
  reviews,
  title = "Avaliações recentes",
}: SellerReviewsCardProps) {
  const avg =
    reviews.length > 0
      ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length
      : 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl border border-border bg-card p-5 shadow-card"
    >
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground">{title}</h3>
          {reviews.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Média {avg.toFixed(1)} · {reviews.length} avaliações
            </p>
          )}
        </div>
        <Badge variant="secondary" className="gap-1">
          <Star className="h-3 w-3 fill-warning text-warning" /> {avg.toFixed(1)}
        </Badge>
      </header>

      {reviews.length === 0 ? (
        <EmptyState
          icon="Star"
          title="Sem avaliações"
          description="Assim que receber pedidos, as avaliações aparecerão aqui."
        />
      ) : (
        <ul className="divide-y divide-border">
          {reviews.slice(0, 4).map((r) => {
            const initials = r.author
              .split(" ")
              .map((p) => p[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();
            return (
              <li key={r.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarImage src={r.avatarUrl} alt={r.author} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {r.author}
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-xs">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={cn(
                            "h-3 w-3",
                            i < Math.round(r.rating)
                              ? "fill-warning text-warning"
                              : "text-muted-foreground/40",
                          )}
                        />
                      ))}
                    </span>
                  </div>
                  {r.productTitle && (
                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {r.productTitle}
                    </div>
                  )}
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {r.comment}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </motion.section>
  );
}
