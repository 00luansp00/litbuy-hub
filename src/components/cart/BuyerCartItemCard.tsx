import { Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BuyerCartItem } from "@/services/cartApiService";
import { formatBrlMinorUnits } from "./formatMinorUnits";

type BuyerCartItemCardProps = {
  item: BuyerCartItem;
  disabled: boolean;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
};

const money = (value: string | null) =>
  value === null ? "Valor não disponível" : formatBrlMinorUnits(value);

export function BuyerCartItemCard({
  item,
  disabled,
  onQuantityChange,
  onRemove,
}: BuyerCartItemCardProps) {
  return (
    <article
      className="space-y-4 rounded-xl border bg-card p-4"
      data-testid={`cart-item-${item.id}`}
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row">
        <div className="min-w-0">
          <Link
            to="/produto/$id"
            params={{ id: item.product.slug }}
            className="font-semibold hover:text-primary hover:underline"
          >
            {item.product.title}
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">
            Modelo: {item.product.model}
            {item.variant ? ` · Variante: ${item.variant.title}` : ""}
          </p>
        </div>
        <div className="shrink-0 text-left sm:text-right">
          <p className="font-semibold">{money(item.currentLineAmountMinor)}</p>
          <p className="text-xs text-muted-foreground">
            {money(item.currentUnitAmountMinor)} por unidade
          </p>
        </div>
      </div>

      {!item.purchasable && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3" role="alert">
          <p className="text-sm font-medium text-destructive">Este item precisa de atenção.</p>
          <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
            {item.issues.map((issue) => (
              <li key={issue}>{issue.replaceAll("_", " ")}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2" aria-label={`Quantidade de ${item.product.title}`}>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={`Diminuir quantidade de ${item.product.title}`}
            disabled={disabled || item.quantity <= 1}
            onClick={() => onQuantityChange(item.quantity - 1)}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="min-w-8 text-center text-sm font-medium">{item.quantity}</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={`Aumentar quantidade de ${item.product.title}`}
            disabled={disabled || item.quantity >= 999}
            onClick={() => onQuantityChange(item.quantity + 1)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive"
          disabled={disabled}
          onClick={onRemove}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Remover
        </Button>
      </div>
    </article>
  );
}
