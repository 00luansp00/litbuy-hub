import { ArrowUpDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCompact } from "@/lib/format";
import { cn } from "@/lib/utils";

interface SortBarProps {
  /** Total de itens da listagem. */
  total: number;
  /** Callback opcional — mantido para futura integração. */
  onSortChange?: (value: string) => void;
  className?: string;
}

export const SORT_OPTIONS = [
  { value: "relevance", label: "Mais relevantes" },
  { value: "price-asc", label: "Menor preço" },
  { value: "price-desc", label: "Maior preço" },
  { value: "best-sellers", label: "Mais vendidos" },
  { value: "rating", label: "Melhor avaliação" },
] as const;

/**
 * SortBar — cabeçalho da listagem com contagem + dropdown de ordenação.
 * Zero lógica: o valor selecionado apenas dispara o callback opcional.
 */
export function SortBar({ total, onSortChange, className }: SortBarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{formatCompact(total)}</span>{" "}
        {total === 1 ? "anúncio encontrado" : "anúncios encontrados"}
      </p>

      <div className="flex items-center gap-2">
        <ArrowUpDown className="h-4 w-4 text-muted-foreground" aria-hidden />
        <Select defaultValue="relevance" onValueChange={onSortChange}>
          <SelectTrigger className="h-9 w-[200px] text-sm">
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
