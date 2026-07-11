import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VerificationSecurityNotice } from "./VerificationSecurityNotice";

interface Props {
  onContinue: () => void;
}

export function VerificationBasicStep({ onContinue }: Props) {
  return (
    <div className="space-y-4">
      <VerificationSecurityNotice variant="compact" />
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="v-name">Nome completo (demonstrativo)</Label>
          <Input id="v-name" placeholder="Ex.: Maria Fictícia da Silva" defaultValue="Maria Demonstração" />
        </div>
        <div>
          <Label htmlFor="v-doc">Documento (mascarado)</Label>
          <Input id="v-doc" placeholder="000.000.000-00" defaultValue="•••.•••.•••-00" />
        </div>
        <div>
          <Label htmlFor="v-birth">Data de nascimento (opcional)</Label>
          <Input id="v-birth" type="date" defaultValue="1995-01-01" />
        </div>
        <div>
          <Label htmlFor="v-country">País</Label>
          <Input id="v-country" defaultValue="Brasil" />
        </div>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onContinue}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
