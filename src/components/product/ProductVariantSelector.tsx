import { CheckCircle2, PackageX, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ListingVariant } from "@/types";

interface ProductVariantSelectorProps {
  variants: ListingVariant[];
  selectedId?: string;
  onSelect: (variant: ListingVariant) => void;
  className?: string;
}

/**
 * ProductVariantSelector — seletor obrigatório para produtos dinâmicos.
 * Cada variação exibe preço, estoque e status. Variações indisponíveis
 * ficam bloqueadas visualmente. Sem persistência.
 */
export function ProductVariantSelector({
  variants,
  selectedId,
  onSelect,
  className,
}: ProductVariantSelectorProps) {
  if (variants.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Escolha uma variação
        </h3>
        <span className="text-[11px] text-muted-foreground">
          {variants.length} opções disponíveis
        </span>
      </div>
      <ul className="space-y-2" role="radiogroup" aria-label="Variações do anúncio">
        {variants.map((v) => {
          const outOfStock = v.stock <= 0;
          const paused = v.status === "paused";
          const disabled = outOfStock || paused;
          const active = v.id === selectedId;

          return (
            <li key={v.id}>
              <button
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => !disabled && onSelect(v)}
                disabled={disabled}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-all",
                  active
                    ? "border-primary bg-primary/5 shadow-elegant"
                    : "border-border bg-surface/40 hover:border-primary/40",
                  disabled && "cursor-not-allowed opacity-60 hover:border-border",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {v.title}
                    </span>
                    {active && (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    )}
                    {paused && (
                      <Badge variant="outline" className="gap-1 text-[10px]">
                        <XCircle className="h-3 w-3" /> Indisponível
                      </Badge>
                    )}
                    {outOfStock && !paused && (
                      <Badge variant="outline" className="gap-1 text-[10px]">
                        <PackageX className="h-3 w-3" /> Esgotado
                      </Badge>
                    )}
                  </div>
                  {v.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                      {v.description}
                    </p>
                  )}
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Estoque: {Math.max(0, v.stock)}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold text-foreground">
                    {formatBRL(v.price)}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
