import { Link } from "@tanstack/react-router";
import { Package, LayoutGrid, Store, Search as SearchIcon } from "lucide-react";
import type { SearchSuggestion } from "@/types";

interface SearchSuggestionsProps {
  items: SearchSuggestion[];
  onSelect?: (item: SearchSuggestion) => void;
}

const ICON: Record<SearchSuggestion["kind"], typeof Package> = {
  product: Package,
  category: LayoutGrid,
  seller: Store,
  query: SearchIcon,
};

export function SearchSuggestions({ items, onSelect }: SearchSuggestionsProps) {
  if (items.length === 0) return null;
  return (
    <ul className="max-h-80 overflow-y-auto py-1">
      {items.map((s) => {
        const Icon = ICON[s.kind];
        return (
          <li key={s.id}>
            <Link
              to="/buscar"
              search={{ q: s.label }}
              onClick={() => onSelect?.(s)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface"
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{s.label}</span>
              <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
                {s.kind === "product"
                  ? "produto"
                  : s.kind === "category"
                    ? "categoria"
                    : s.kind === "seller"
                      ? "loja"
                      : "busca"}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
