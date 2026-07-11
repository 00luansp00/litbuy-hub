import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ListingAttributeConfig, ListingAttributeValue } from "@/types";

interface Props {
  config: ListingAttributeConfig[];
  value: ListingAttributeValue[];
  onChange: (v: ListingAttributeValue[]) => void;
}

export function AttributesFields({ config, value, onChange }: Props) {
  if (config.length === 0) return null;
  const get = (key: string) => value.find((v) => v.key === key)?.value ?? "";
  const set = (key: string, val: string) => {
    const rest = value.filter((v) => v.key !== key);
    onChange(val ? [...rest, { key, value: val }] : rest);
  };

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface/40 p-4">
      <div>
        <h4 className="text-sm font-semibold text-foreground">
          Atributos do produto
        </h4>
        <p className="text-xs text-muted-foreground">
          Campos variam conforme a subcategoria ou tipo do produto.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {config.map((f) => (
          <div key={f.key}>
            <Label className="mb-1.5 block text-xs">{f.label}</Label>
            {f.type === "select" ? (
              <select
                value={get(f.key)}
                onChange={(e) => set(f.key, e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Selecionar</option>
                {(f.options ?? []).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                type={f.type === "number" ? "number" : "text"}
                value={get(f.key)}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder={f.placeholder}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
