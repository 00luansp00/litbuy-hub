import { AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ListingServiceInfo, ListingServicePricingType } from "@/types";

interface Props {
  value: ListingServiceInfo;
  onChange: (v: ListingServiceInfo) => void;
}

export function ServiceFields({ value, onChange }: Props) {
  const patch = (p: Partial<ListingServiceInfo>) => onChange({ ...value, ...p });
  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-1.5 block">Título do serviço</Label>
        <Input
          value={value.title ?? ""}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder="Ex.: Boost de Elo até Diamante"
        />
      </div>
      <div>
        <Label className="mb-1.5 block">Descrição do serviço</Label>
        <Textarea
          rows={4}
          value={value.description ?? ""}
          onChange={(e) => patch({ description: e.target.value })}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="mb-1.5 block">Preço base (BRL)</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={value.basePrice ?? ""}
            onChange={(e) =>
              patch({
                basePrice: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
        </div>
        <div>
          <Label className="mb-1.5 block">Tipo de preço</Label>
          <select
            value={value.pricingType ?? ""}
            onChange={(e) =>
              patch({
                pricingType:
                  (e.target.value as ListingServicePricingType) || undefined,
              })
            }
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Selecionar</option>
            <option value="fixed">Preço fixo</option>
            <option value="quote">Sob orçamento</option>
          </select>
        </div>
        <div>
          <Label className="mb-1.5 block">Prazo estimado</Label>
          <Input
            value={value.estimatedDelivery ?? ""}
            onChange={(e) => patch({ estimatedDelivery: e.target.value })}
            placeholder="Ex.: 3 a 5 dias"
          />
        </div>
      </div>
      <div>
        <Label className="mb-1.5 block">Requisitos do comprador</Label>
        <Textarea
          rows={3}
          value={value.buyerRequirements ?? ""}
          onChange={(e) => patch({ buyerRequirements: e.target.value })}
          placeholder="Ex.: conta ativa, nível mínimo, região..."
        />
      </div>
      <div>
        <Label className="mb-1.5 block">Observações importantes</Label>
        <Textarea
          rows={2}
          value={value.notes ?? ""}
          onChange={(e) => patch({ notes: e.target.value })}
        />
      </div>
      {value.pricingType === "quote" && (
        <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Serviços sob orçamento futuramente deverão iniciar uma conversa com o
            vendedor antes do pagamento.
          </p>
        </div>
      )}
    </div>
  );
}
