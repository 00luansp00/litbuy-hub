import { Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { orderService } from "@/services/orderService";
import type { OrderReview, OrderStatus } from "@/types";

interface OrderReviewCardProps {
  orderId: string;
  status: OrderStatus;
  review?: OrderReview | null;
}

export function OrderReviewCard({ orderId, status, review }: OrderReviewCardProps) {
  const canReview = status === "completed";
  const [productRating, setProductRating] = useState(review?.productRating ?? 0);
  const [sellerRating, setSellerRating] = useState(review?.sellerRating ?? 0);
  const [comment, setComment] = useState(review?.comment ?? "");
  const [submitting, setSubmitting] = useState(false);
  const submitted = !!review?.submittedAt;

  const handleSubmit = async () => {
    if (!productRating || !sellerRating) {
      toast.error("Avalie o produto e o vendedor antes de enviar.");
      return;
    }
    setSubmitting(true);
    await orderService.simulateSubmitReview(orderId, {
      productRating,
      sellerRating,
      comment,
    });
    setSubmitting(false);
    toast.success("Avaliação enviada (mock)", {
      description: "Nada foi salvo — avaliações reais exigem backend.",
    });
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card md:p-6">
      <header className="mb-3">
        <h2 className="text-sm font-semibold text-foreground">
          Avalie sua compra
        </h2>
        <p className="text-xs text-muted-foreground">
          A avaliação real só é liberada após o pedido ser marcado como concluído.
        </p>
      </header>

      {!canReview ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/50 p-4 text-sm text-muted-foreground">
          A avaliação ficará disponível assim que o pedido for concluído.
        </div>
      ) : (
        <div className="space-y-4">
          <RatingRow
            label="Nota do produto"
            value={productRating}
            onChange={setProductRating}
            disabled={submitted}
          />
          <RatingRow
            label="Nota do vendedor"
            value={sellerRating}
            onChange={setSellerRating}
            disabled={submitted}
          />
          <div className="space-y-2">
            <Label htmlFor="review-comment">Comentário</Label>
            <Textarea
              id="review-comment"
              rows={3}
              placeholder="Conte como foi sua experiência (opcional)."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={submitted}
            />
          </div>
          <Button onClick={handleSubmit} disabled={submitting || submitted}>
            {submitted ? "Avaliação enviada" : "Enviar avaliação"}
          </Button>
        </div>
      )}
    </section>
  );
}

function RatingRow({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
            onClick={() => !disabled && onChange(n)}
            className={cn(
              "grid h-9 w-9 place-items-center rounded-md transition-colors",
              disabled ? "cursor-not-allowed opacity-70" : "hover:bg-surface",
            )}
          >
            <Star
              className={cn(
                "h-5 w-5",
                n <= value
                  ? "fill-warning text-warning"
                  : "text-muted-foreground",
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
