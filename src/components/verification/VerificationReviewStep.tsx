import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { verificationService } from "@/services/verificationService";
import { VerificationSecurityNotice } from "./VerificationSecurityNotice";

interface Props {
  onSubmitted: () => void;
}

export function VerificationReviewStep({ onSubmitted }: Props) {
  const submit = async () => {
    const r = await verificationService.simulateSubmitVerification();
    toast.success("Enviado para análise (mock)", { description: `Protocolo: ${r.submissionId}` });
    onSubmitted();
  };

  return (
    <div className="space-y-4">
      <VerificationSecurityNotice />
      <div className="rounded-xl border border-border bg-surface/40 p-4">
        <h4 className="text-sm font-semibold text-foreground">Resumo da verificação</h4>
        <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
          <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> Dados básicos preenchidos</li>
          <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> Telefone confirmado por SMS (mock)</li>
          <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> Documento enviado (mock)</li>
          <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> Selfie enviada (mock)</li>
        </ul>
      </div>
      <div className="flex justify-end">
        <Button onClick={submit}>Enviar para análise</Button>
      </div>
    </div>
  );
}
