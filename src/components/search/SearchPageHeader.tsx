import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SearchStats } from "@/types";

interface SearchPageHeaderProps {
  query: string;
  stats?: SearchStats | null;
}

export function SearchPageHeader({ query, stats }: SearchPageHeaderProps) {
  if (!query) {
    return (
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground">
          <Search className="h-3 w-3" /> Busca global
        </div>
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">
          Busque por produtos digitais
        </h1>
        <p className="text-sm text-muted-foreground">
          Encontre contas, gift cards, moedas, skins e serviços — tudo em um só lugar.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Search className="h-3.5 w-3.5" />
        Resultados de busca
      </div>
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">
          Resultados para: <span className="text-primary">“{query}”</span>
        </h1>
        {stats && (
          <Badge variant="secondary" className="rounded-full">
            {stats.total} {stats.total === 1 ? "produto" : "produtos"}
          </Badge>
        )}
      </div>
      {stats && stats.total > 0 && (
        <p className="text-sm text-muted-foreground">
          {stats.categoriesMatched} categoria(s) • {stats.sellersMatched} vendedor(es)
        </p>
      )}
    </div>
  );
}
