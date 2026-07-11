import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { MessageCircle, Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AuthGate } from "@/components/auth/AuthGate";
import { SellerDashboardLayout } from "@/components/seller-dashboard/SellerDashboardLayout";
import { EmptyState } from "@/components/common/EmptyState";
import { sellerDashboardService } from "@/services/sellerDashboardService";
import { cn } from "@/lib/utils";
import type { SellerReview } from "@/types";

export const Route = createFileRoute("/vendedor/avaliacoes")({
  component: () => (
    <AuthGate
      title="Entre para acessar suas avaliações"
      description="Você precisa estar logado para ver e responder avaliações."
    >
      <AvaliacoesPage />
    </AuthGate>
  ),
});

function AvaliacoesPage() {
  const [reviews, setReviews] = useState<SellerReview[] | null>(null);

  useEffect(() => {
    let mounted = true;
    sellerDashboardService.getSellerReviews(12).then((r) => {
      if (mounted) setReviews(r);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const list = reviews ?? [];
  const avg =
    list.length > 0 ? list.reduce((acc, r) => acc + r.rating, 0) / list.length : 0;

  const distribution = [5, 4, 3, 2, 1].map((star) => {
    const count = list.filter((r) => Math.round(r.rating) === star).length;
    const pct = list.length > 0 ? (count / list.length) * 100 : 0;
    return { star, count, pct };
  });

  return (
    <SellerDashboardLayout
      title="Avaliações"
      description="Feedback dos seus compradores — dados mockados."
    >
      {reviews === null ? (
        <div className="h-40 animate-pulse rounded-2xl border border-border bg-card" />
      ) : list.length === 0 ? (
        <EmptyState
          icon="Star"
          title="Nenhuma avaliação ainda"
          description="Suas avaliações aparecerão aqui após vendas concluídas."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-foreground">{avg.toFixed(1)}</span>
              <span className="text-sm text-muted-foreground">/ 5.0</span>
            </div>
            <div className="mt-1 inline-flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    "h-4 w-4",
                    i < Math.round(avg)
                      ? "fill-warning text-warning"
                      : "text-muted-foreground/40",
                  )}
                />
              ))}
              <span className="ml-2 text-xs text-muted-foreground">
                {list.length} avaliações
              </span>
            </div>
            <div className="mt-4 space-y-2">
              {distribution.map((d) => (
                <div key={d.star} className="flex items-center gap-2 text-xs">
                  <span className="w-6 text-muted-foreground">{d.star}★</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
                    <div
                      className="h-full bg-warning"
                      style={{ width: `${d.pct}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-muted-foreground">{d.count}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            {list.map((r) => {
              const initials = r.author
                .split(" ")
                .map((p) => p[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();
              return (
                <article
                  key={r.id}
                  className="rounded-2xl border border-border bg-card p-4 shadow-card"
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={r.avatarUrl} alt={r.author} />
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-medium text-foreground">
                            {r.author}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {new Date(r.date).toLocaleDateString("pt-BR")}
                            {r.productTitle && ` · ${r.productTitle}`}
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-0.5">
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
                      <p className="mt-2 text-sm text-muted-foreground">{r.comment}</p>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <Badge variant="secondary" className="text-[10px]">
                          Demo
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            toast("Em breve", {
                              description:
                                "Responder avaliações será liberado com backend.",
                            })
                          }
                        >
                          <MessageCircle className="mr-2 h-4 w-4" /> Responder
                        </Button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        </div>
      )}
    </SellerDashboardLayout>
  );
}
