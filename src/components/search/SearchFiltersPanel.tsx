import { Star, Zap, ShieldCheck, PackageCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { SearchFacets, SearchFilters } from "@/types";

interface SearchFiltersProps {
  facets: SearchFacets | null;
  filters: SearchFilters;
  onChange: (next: SearchFilters) => void;
  onReset: () => void;
}

export function SearchFiltersPanel({
  facets,
  filters,
  onChange,
  onReset,
}: SearchFiltersProps) {
  const patch = (partial: Partial<SearchFilters>) =>
    onChange({ ...filters, ...partial });

  return (
    <aside className="space-y-6 rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Filtros</h2>
        <Button variant="ghost" size="sm" onClick={onReset}>
          Limpar
        </Button>
      </div>

      <section className="space-y-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Categoria
        </Label>
        <div className="flex flex-wrap gap-1.5">
          <Badge
            variant={!filters.categorySlug ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => patch({ categorySlug: undefined })}
          >
            Todas
          </Badge>
          {facets?.categories.slice(0, 8).map((c) => (
            <Badge
              key={c.value}
              variant={filters.categorySlug === c.value ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => patch({ categorySlug: c.value })}
            >
              {c.label}
            </Badge>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Preço (R$)
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            inputMode="decimal"
            placeholder="Min"
            value={filters.minPrice ?? ""}
            onChange={(e) =>
              patch({
                minPrice: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
          <Input
            type="number"
            inputMode="decimal"
            placeholder="Max"
            value={filters.maxPrice ?? ""}
            onChange={(e) =>
              patch({
                maxPrice: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
        </div>
        {facets && (
          <p className="text-[11px] text-muted-foreground">
            Faixa mockada: R$ {facets.priceRange.min} – R$ {facets.priceRange.max}
          </p>
        )}
      </section>

      <section className="space-y-3">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Preferências
        </Label>

        <ToggleRow
          icon={<Zap className="h-4 w-4 text-warning" />}
          label="Entrega instantânea"
          checked={!!filters.instantDelivery}
          onCheckedChange={(v) => patch({ instantDelivery: v || undefined })}
        />
        <ToggleRow
          icon={<ShieldCheck className="h-4 w-4 text-success" />}
          label="Vendedor verificado"
          checked={!!filters.verifiedSeller}
          onCheckedChange={(v) => patch({ verifiedSeller: v || undefined })}
        />
        <ToggleRow
          icon={<PackageCheck className="h-4 w-4 text-primary" />}
          label="Apenas disponíveis"
          checked={!!filters.onlyAvailable}
          onCheckedChange={(v) => patch({ onlyAvailable: v || undefined })}
        />
      </section>

      <section className="space-y-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Avaliação mínima
        </Label>
        <div className="flex gap-1.5">
          {[0, 3, 4, 4.5].map((r) => (
            <Badge
              key={r}
              variant={filters.minRating === r || (!filters.minRating && r === 0) ? "default" : "outline"}
              className="cursor-pointer gap-1"
              onClick={() => patch({ minRating: r === 0 ? undefined : r })}
            >
              {r === 0 ? "Todas" : (
                <>
                  <Star className="h-3 w-3 fill-warning text-warning" />
                  {r}+
                </>
              )}
            </Badge>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Plataforma
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {["Todas", "PC", "PlayStation", "Xbox", "Mobile"].map((p) => {
            const value = p === "Todas" ? undefined : p;
            const active =
              (filters.platform ?? undefined) === value ||
              (!filters.platform && p === "Todas");
            return (
              <Badge
                key={p}
                variant={active ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => patch({ platform: value })}
              >
                {p}
              </Badge>
            );
          })}
        </div>
      </section>
    </aside>
  );
}

function ToggleRow({
  icon,
  label,
  checked,
  onCheckedChange,
}: {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border/60 bg-surface/50 px-3 py-2 text-sm">
      <span className="flex items-center gap-2 text-foreground">
        {icon}
        {label}
      </span>
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(Boolean(v))}
      />
    </label>
  );
}
