import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface AdminFilterOption {
  value: string;
  label: string;
}

interface AdminFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  status?: string;
  onStatusChange?: (v: string) => void;
  statusOptions?: AdminFilterOption[];
  risk?: string;
  onRiskChange?: (v: string) => void;
  period?: string;
  onPeriodChange?: (v: string) => void;
  sort?: string;
  onSortChange?: (v: string) => void;
  sortOptions?: AdminFilterOption[];
  className?: string;
}

const RISK_OPTIONS: AdminFilterOption[] = [
  { value: "all", label: "Risco: todos" },
  { value: "low", label: "Risco: baixo" },
  { value: "medium", label: "Risco: médio" },
  { value: "high", label: "Risco: alto" },
  { value: "critical", label: "Risco: crítico" },
];

const PERIOD_OPTIONS: AdminFilterOption[] = [
  { value: "all", label: "Período: todo" },
  { value: "today", label: "Hoje" },
  { value: "week", label: "Últimos 7 dias" },
  { value: "month", label: "Últimos 30 dias" },
];

const SORT_DEFAULT: AdminFilterOption[] = [
  { value: "recent", label: "Mais recentes" },
  { value: "older", label: "Mais antigos" },
];

export function AdminFilters({
  search,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  status,
  onStatusChange,
  statusOptions,
  risk,
  onRiskChange,
  period,
  onPeriodChange,
  sort,
  onSortChange,
  sortOptions,
  className,
}: AdminFiltersProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-border bg-card p-3 md:flex-row md:items-center",
        className,
      )}
    >
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-9"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {statusOptions && onStatusChange && (
          <Select value={status ?? "all"} onValueChange={onStatusChange}>
            <SelectTrigger className="h-9 w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {onRiskChange && (
          <Select value={risk ?? "all"} onValueChange={onRiskChange}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RISK_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {onPeriodChange && (
          <Select value={period ?? "all"} onValueChange={onPeriodChange}>
            <SelectTrigger className="h-9 w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {onSortChange && (
          <Select value={sort ?? "recent"} onValueChange={onSortChange}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(sortOptions ?? SORT_DEFAULT).map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}
