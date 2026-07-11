import { useMemo } from "react";
import { ShieldAlert, Lock } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface Props {
  value: string[];
  onChange: (lines: string[]) => void;
}

const mask = (s: string) => {
  const clean = s.trim();
  if (!clean) return "";
  const tail = clean.slice(-3);
  return `${"•".repeat(Math.max(6, clean.length - 3))}${tail}`;
};

export function SecureVaultMock({ value, onChange }: Props) {
  const text = value.join("\n");
  const preview = useMemo(
    () =>
      value
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 5),
    [value],
  );
  return (
    <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold text-foreground">
          Cofre Seguro de Entrega
        </h4>
        <Badge variant="secondary" className="text-[10px]">Demo</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Cole um item por linha. Cada linha representa uma unidade de estoque a ser
        entregue automaticamente após o pagamento aprovado (comportamento futuro).
      </p>

      <div>
        <Label className="mb-1.5 block text-xs">Itens do cofre</Label>
        <Textarea
          rows={5}
          value={text}
          onChange={(e) =>
            onChange(e.target.value.split("\n").map((l) => l).filter(() => true))
          }
          placeholder={"codigo-demo-001\ncodigo-demo-002\ncodigo-demo-003"}
          className="font-mono text-xs"
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-md border border-border bg-background p-2 text-xs">
          <div className="text-muted-foreground">Total de linhas</div>
          <div className="font-semibold text-foreground">
            {value.filter((l) => l.trim().length > 0).length}
          </div>
        </div>
        <div className="rounded-md border border-border bg-background p-2 text-xs">
          <div className="text-muted-foreground">Estoque calculado</div>
          <div className="font-semibold text-foreground">
            {value.filter((l) => l.trim().length > 0).length}
          </div>
        </div>
      </div>

      {preview.length > 0 && (
        <div className="rounded-md border border-border bg-background p-3">
          <div className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            Preview mascarado
          </div>
          <ul className="space-y-1 font-mono text-xs">
            {preview.map((l, i) => (
              <li key={i}>
                Item {i + 1}: <span className="text-foreground">{mask(l)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Modo demonstração. Não insira senhas, logins, códigos reais ou
          credenciais reais. O cofre seguro real exigirá backend, criptografia e
          auditoria.
        </p>
      </div>
    </div>
  );
}
