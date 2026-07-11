import { useMemo, useState } from "react";
import { Coins, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBRL } from "@/lib/format";
import type { VirtualCurrencyConfig, VirtualCurrencyQuote } from "@/types";

interface VirtualCurrencyQuoteBoxProps {
  config: VirtualCurrencyConfig;
  onAdd: (quote: VirtualCurrencyQuote) => void;
  disabled?: boolean;
}

export function computeQuote(
  config: VirtualCurrencyConfig,
  quantity: number,
): VirtualCurrencyQuote {
  return {
    quantity,
    unit: config.unit,
    unitPrice: config.pricePerUnit,
    total: Math.max(0, quantity * config.pricePerUnit),
    belowMin: quantity < config.minQuantity,
    overStock: quantity > config.availableStock,
  };
}

export function VirtualCurrencyQuoteBox({
  config,
  onAdd,
  disabled,
}: VirtualCurrencyQuoteBoxProps) {
  const [quantity, setQuantity] = useState<number>(config.minQuantity);
  const quote = useMemo(() => computeQuote(config, quantity), [config, quantity]);
  const step = config.step ?? Math.max(1, Math.floor(config.minQuantity / 10) || 1);

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface/40 p-4">
      <header className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-warning/15 text-warning">
          <Coins className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Cotação visual — {config.unit}
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Simulação demonstrativa. A cotação real dependerá do backend.
          </p>
        </div>
      </header>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          Quantidade desejada ({config.unit})
        </span>
        <Input
          type="number"
          min={0}
          step={step}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(0, Number(e.target.value) || 0))}
        />
      </label>

      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-background/60 p-2">
          <dt className="text-muted-foreground">Preço por unidade</dt>
          <dd className="font-semibold text-foreground">
            {formatBRL(config.pricePerUnit)}
          </dd>
        </div>
        <div className="rounded-lg bg-background/60 p-2">
          <dt className="text-muted-foreground">Estoque disponível</dt>
          <dd className="font-semibold text-foreground">
            {config.availableStock.toLocaleString("pt-BR")} {config.unit}
          </dd>
        </div>
        <div className="rounded-lg bg-background/60 p-2">
          <dt className="text-muted-foreground">Mínimo</dt>
          <dd className="font-semibold text-foreground">
            {config.minQuantity.toLocaleString("pt-BR")} {config.unit}
          </dd>
        </div>
        <div className="rounded-lg bg-primary/10 p-2">
          <dt className="text-muted-foreground">Total estimado</dt>
          <dd className="text-base font-bold text-foreground">
            {formatBRL(quote.total)}
          </dd>
        </div>
      </dl>

      {quote.belowMin && (
        <p className="flex items-start gap-1.5 text-[11px] text-warning">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Quantidade abaixo do mínimo ({config.minQuantity.toLocaleString("pt-BR")}{" "}
          {config.unit}).
        </p>
      )}
      {quote.overStock && (
        <p className="flex items-start gap-1.5 text-[11px] text-destructive">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Quantidade acima do estoque disponível.
        </p>
      )}

      <Button
        className="w-full"
        disabled={disabled || quote.belowMin || quote.overStock || quote.total <= 0}
        onClick={() => onAdd(quote)}
      >
        Adicionar ao carrinho
      </Button>
      <p className="text-[10px] text-muted-foreground">
        Esta cotação é demonstrativa. A cotação real dependerá do estoque e
        regras do backend.
      </p>
    </section>
  );
}
