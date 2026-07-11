import { useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { verificationService } from "@/services/verificationService";
import type { VerificationAcceptedDocument, VerificationDocumentType } from "@/types";
import { VerificationSecurityNotice } from "./VerificationSecurityNotice";

interface Props {
  documents: VerificationAcceptedDocument[];
  onContinue: () => void;
}

export function VerificationDocumentStep({ documents, onContinue }: Props) {
  const [type, setType] = useState<VerificationDocumentType>("rg");

  const submit = async () => {
    await verificationService.simulateSubmitDocument();
    toast.success("Documento enviado (mock)");
    onContinue();
  };

  return (
    <div className="space-y-4">
      <VerificationSecurityNotice variant="compact" />
      <div>
        <Label>Tipo de documento</Label>
        <Select value={type} onValueChange={(v) => setType(v as VerificationDocumentType)}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {documents.map((d) => (
              <SelectItem key={d.type} value={d.type} disabled={d.type === "foreign_id"}>
                {d.label} — {d.description}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <DocumentDropzone label="Frente do documento" />
        <DocumentDropzone label="Verso do documento" />
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={submit}>
          Enviar documento (mock)
        </Button>
      </div>
    </div>
  );
}

function DocumentDropzone({ label }: { label: string }) {
  return (
    <div
      className="grid place-items-center rounded-xl border border-dashed border-border bg-surface/40 p-6 text-center"
      role="button"
      tabIndex={0}
      onClick={() => toast("Upload demonstrativo — nenhum arquivo é enviado.")}
    >
      <Upload className="mb-2 h-6 w-6 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Demonstração — não envie documentos reais.
      </p>
    </div>
  );
}
