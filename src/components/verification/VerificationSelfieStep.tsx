import { toast } from "sonner";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { verificationService } from "@/services/verificationService";
import { VerificationSecurityNotice } from "./VerificationSecurityNotice";

interface Props {
  onContinue: () => void;
}

export function VerificationSelfieStep({ onContinue }: Props) {
  const submit = async () => {
    await verificationService.simulateSubmitSelfie();
    toast.success("Selfie enviada (mock)");
    onContinue();
  };

  return (
    <div className="space-y-4">
      <VerificationSecurityNotice variant="compact" />
      <div
        className="grid place-items-center rounded-2xl border border-dashed border-border bg-surface/40 p-10 text-center"
      >
        <Camera className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Enviar selfie (demonstração)</p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          Em produção, o comprador tira uma selfie ao vivo para prova de vida. Aqui, nada é
          capturado ou armazenado.
        </p>
        <Button className="mt-4" type="button" onClick={submit}>
          Simular envio de selfie
        </Button>
      </div>
      <ul className="grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
        <li>• Rosto centralizado.</li>
        <li>• Boa iluminação.</li>
        <li>• Sem óculos ou boné.</li>
      </ul>
    </div>
  );
}
