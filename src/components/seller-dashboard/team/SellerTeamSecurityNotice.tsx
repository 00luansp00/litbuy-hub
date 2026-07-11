import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function SellerTeamSecurityNotice() {
  return (
    <Alert className="border-warning/30 bg-warning/10">
      <AlertTriangle className="h-4 w-4 text-warning" />
      <AlertTitle>Equipe demonstrativa</AlertTitle>
      <AlertDescription className="text-xs space-y-1">
        <p>Permissões e convites são visuais. Nenhum e-mail real é enviado.</p>
        <ul className="ml-4 list-disc">
          <li>Em produção, cada membro precisa da própria conta e login.</li>
          <li>Permissões reais exigem RBAC no backend.</li>
          <li>Ações críticas (saque, financeiro) exigem audit log.</li>
          <li>Nunca compartilhe senha entre membros da equipe.</li>
        </ul>
      </AlertDescription>
    </Alert>
  );
}
