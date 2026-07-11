import { ShieldAlert } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type {
  AccountProvenance,
  AccountRecoveryLevel,
  ListingAccountInfo,
} from "@/types";

interface Props {
  value: ListingAccountInfo;
  onChange: (v: ListingAccountInfo) => void;
}

const PROVENANCE: { id: AccountProvenance; label: string }[] = [
  { id: "original_owner", label: "Sou o criador/dono original" },
  { id: "reseller", label: "Sou revendedor" },
  { id: "third_party", label: "Conta adquirida de terceiro" },
  { id: "other", label: "Outra procedência" },
];

const RECOVERY: { id: AccountRecoveryLevel; label: string }[] = [
  { id: "full", label: "Dados de recuperação completos" },
  { id: "partial", label: "Dados parciais" },
  { id: "none", label: "Não possui dados de recuperação" },
  { id: "unknown", label: "Não sei informar" },
];

export function AccountFields({ value, onChange }: Props) {
  const patch = (p: Partial<ListingAccountInfo>) => onChange({ ...value, ...p });

  return (
    <div className="space-y-5 rounded-xl border border-border bg-surface/40 p-4">
      <div>
        <h4 className="text-sm font-semibold text-foreground">
          Informações da conta
        </h4>
        <p className="text-xs text-muted-foreground">
          Campos específicos para produto do tipo Conta.
        </p>
      </div>

      <div>
        <Label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">
          Procedência
        </Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {PROVENANCE.map((p) => (
            <label
              key={p.id}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background p-2 text-sm"
            >
              <input
                type="radio"
                name="provenance"
                checked={value.provenance === p.id}
                onChange={() => patch({ provenance: p.id })}
              />
              {p.label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <Label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">
          Dados de recuperação
        </Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {RECOVERY.map((r) => (
            <label
              key={r.id}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background p-2 text-sm"
            >
              <input
                type="radio"
                name="recovery"
                checked={value.recoveryLevel === r.id}
                onChange={() => patch({ recoveryLevel: r.id })}
              />
              {r.label}
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { key: "emailVerified", label: "E-mail verificado" },
          { key: "phoneLinked", label: "Telefone vinculado" },
          { key: "documentLinked", label: "Documento vinculado" },
          { key: "fullAccess", label: "Acesso completo" },
        ].map((f) => (
          <div
            key={f.key}
            className="flex items-center justify-between rounded-md border border-border bg-background p-2"
          >
            <span className="text-sm">{f.label}</span>
            <Switch
              checked={!!value[f.key as keyof ListingAccountInfo]}
              onCheckedChange={(v) => patch({ [f.key]: v } as Partial<ListingAccountInfo>)}
            />
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="mb-1.5 block text-xs">Risco de recuperação</Label>
          <select
            value={value.recoveryRisk ?? ""}
            onChange={(e) =>
              patch({
                recoveryRisk:
                  (e.target.value as ListingAccountInfo["recoveryRisk"]) || undefined,
              })
            }
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Selecionar</option>
            <option value="low">Baixo</option>
            <option value="medium">Médio</option>
            <option value="high">Alto</option>
          </select>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs">Garantia informada</Label>
          <Input
            value={value.warrantyNote ?? ""}
            onChange={(e) => patch({ warrantyNote: e.target.value })}
            placeholder="Ex.: 7 dias contra recuperação"
          />
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Contas digitais possuem risco de recuperação. Informe dados reais e
          completos. A LIT Buy poderá usar essas informações em disputas futuras.
          <span className="mt-1 block text-warning/80">
            Nunca cole senhas, códigos reais ou credenciais nesta demonstração.
          </span>
        </p>
      </div>
    </div>
  );
}
