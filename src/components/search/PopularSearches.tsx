import { Link } from "@tanstack/react-router";
import { Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PopularSearch } from "@/types";

interface PopularSearchesProps {
  items: PopularSearch[];
}

export function PopularSearches({ items }: PopularSearchesProps) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Flame className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">
          Buscas populares
        </h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((p) => (
          <Link
            key={p.id}
            to="/buscar"
            search={{ q: p.term }}
            className="inline-flex"
          >
            <Badge variant="outline" className="cursor-pointer hover:bg-surface">
              {p.term}
            </Badge>
          </Link>
        ))}
      </div>
    </section>
  );
}
