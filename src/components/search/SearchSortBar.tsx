import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SEARCH_SORT_OPTIONS } from "@/services/searchService";
import type { SearchSortOption } from "@/types";

interface SearchSortBarProps {
  total: number;
  sort: SearchSortOption;
  onSortChange: (sort: SearchSortOption) => void;
}

export function SearchSortBar({ total, sort, onSortChange }: SearchSortBarProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{total}</span>{" "}
        {total === 1 ? "resultado" : "resultados"}
      </p>
      <div className="flex items-center gap-2">
        <span className="hidden text-xs text-muted-foreground sm:inline">
          Ordenar por
        </span>
        <Select
          value={sort}
          onValueChange={(v) => onSortChange(v as SearchSortOption)}
        >
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SEARCH_SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
