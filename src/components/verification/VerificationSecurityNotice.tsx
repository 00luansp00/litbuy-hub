import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function VerificationSecurityNotice({ variant = "default" }: { variant?: "default" | "compact" }) {
  if (variant === "compact") {
    return (
      <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning-foreground">
        <strong className="mr-1 text-warning">Demonstração:</strong>
        não envie documentos, dados pessoais reais ou selfies. Este fluxo é apenas visual.
      </div>
    );
  }
  return (
    <Alert className="border-warning/30 bg-warning/10">
      <AlertTriangle className="h-4 w-4 text-warning" />
      <AlertTitle>Fluxo demonstrativo</AlertTitle>
      <AlertDescription className="text-xs">
        Este KYC é <strong>totalmente mockado</strong>. Não envie documentos reais, CPF válido nem selfie. Em
        produção, a verificação real exigirá backend seguro, storage protegido, fornecedor de KYC e
        conformidade com a LGPD.
      </AlertDescription>
    </Alert>
  );
}
