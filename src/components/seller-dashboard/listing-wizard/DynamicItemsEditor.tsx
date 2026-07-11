import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { ListingVariant } from "@/types";

interface Props {
  value: ListingVariant[];
  onChange: (items: ListingVariant[]) => void;
}

const newItem = (): ListingVariant => ({
  id: `var-${Math.random().toString(36).slice(2, 8)}`,
  title: "",
  description: "",
  price: 0,
  stock: 1,
  status: "active",
});

export function DynamicItemsEditor({ value, onChange }: Props) {
  const update = (id: string, patch: Partial<ListingVariant>) =>
    onChange(value.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  const remove = (id: string) => onChange(value.filter((v) => v.id !== id));
  const add = () => onChange([...value, newItem()]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-foreground">Itens do anúncio</h4>
          <p className="text-xs text-muted-foreground">
            Adicione uma variação por linha (ex.: níveis, quantidades, pacotes).
          </p>
        </div>
        <Badge variant="secondary" className="text-[10px]">
          {value.length} {value.length === 1 ? "item" : "itens"}
        </Badge>
      </div>

      {value.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          Nenhuma variação ainda. Adicione ao menos 1 item.
        </div>
      )}

      <div className="space-y-3">
        {value.map((v, i) => (
          <div
            key={v.id}
            className="rounded-xl border border-border bg-surface/40 p-3 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Variação #{i + 1}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => remove(v.id)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remover
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label className="mb-1.5 block text-xs">Nome / título curto</Label>
                <Input
                  value={v.title}
                  onChange={(e) => update(v.id, { title: e.target.value })}
                  placeholder="Ex.: Conta level 15"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">Preço (BRL)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={v.price || ""}
                  onChange={(e) =>
                    update(v.id, { price: Math.max(0, Number(e.target.value) || 0) })
                  }
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">Estoque</Label>
                <Input
                  type="number"
                  min={0}
                  value={v.stock}
                  onChange={(e) =>
                    update(v.id, { stock: Math.max(0, Number(e.target.value) || 0) })
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="mb-1.5 block text-xs">Descrição curta (opcional)</Label>
                <Textarea
                  rows={2}
                  value={v.description ?? ""}
                  onChange={(e) => update(v.id, { description: e.target.value })}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="mr-1.5 h-4 w-4" /> Adicionar variação
      </Button>
    </div>
  );
}
