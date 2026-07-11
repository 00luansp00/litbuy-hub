import { ShieldAlert } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

const MAX = 500;

export function AutomaticMessageField({ value, onChange }: Props) {
  return (
    <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div>
        <h4 className="text-sm font-semibold text-foreground">
          Mensagem automática para o comprador
        </h4>
        <p className="text-xs text-muted-foreground">
          Enviada automaticamente ao comprador após a confirmação do pagamento
          (recurso do plano LIT-MAX).
        </p>
      </div>
      <div>
        <Label className="mb-1.5 block text-xs sr-only">Mensagem</Label>
        <Textarea
          rows={4}
          value={value}
          maxLength={MAX}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ex.: Olá! Obrigado pela compra. Confira as instruções de acesso no pedido..."
        />
        <div className="mt-1 text-right text-[11px] text-muted-foreground">
          {value.length}/{MAX}
        </div>
      </div>

      {value.trim() && (
        <div className="rounded-md border border-border bg-background p-3">
          <div className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            Preview
          </div>
          <p className="whitespace-pre-wrap text-sm text-foreground">{value}</p>
        </div>
      )}

      <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Não envie senhas, códigos reais, links externos, WhatsApp, Telegram,
          Discord pessoal ou qualquer contato fora da LIT Buy. A negociação deve
          permanecer dentro da plataforma.
        </p>
      </div>
    </div>
  );
}
