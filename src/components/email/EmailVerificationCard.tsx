import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Mail, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { analyticsService } from "@/services/analyticsService";
import { transactionalEmailService, maskEmail } from "@/services/transactionalEmailService";

interface Props {
  email: string;
}

export function EmailVerificationCard({ email }: Props) {
  const [status, setStatus] = useState<"pending" | "resending" | "confirmed">("pending");
  const masked = maskEmail(email);

  const resend = async () => {
    setStatus("resending");
    analyticsService.track("email_resend_clicked_mocked", { eventKey: "auth.signup_confirmation" });
    await transactionalEmailService.simulateResendEmail("auth.signup_confirmation");
    toast.success("E-mail reenviado (mock). Nenhum e-mail real foi enviado.");
    setStatus("pending");
  };

  const confirm = () => {
    setStatus("confirmed");
    toast.success("E-mail verificado (mock).");
  };

  if (status === "confirmed") {
    return (
      <div className="rounded-2xl border border-success/30 bg-success/5 p-6 text-center">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-success/20">
          <CheckCircle2 className="h-6 w-6 text-success" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">E-mail verificado</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tudo pronto — sua conta agora está confirmada em modo demonstração.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-surface/60 p-6">
      <header className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
          <Mail className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Verifique seu e-mail</h1>
          <p className="text-xs text-muted-foreground">
            Enviamos instruções para <span className="font-medium text-foreground">{masked}</span>
          </p>
        </div>
      </header>
      <p className="text-sm text-muted-foreground">
        Abra a caixa de entrada do seu e-mail e clique no link de confirmação. Se não encontrar,
        verifique a caixa de spam.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={resend} variant="outline" className="flex-1" disabled={status === "resending"}>
          {status === "resending" ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reenviando...</>
          ) : (
            <><RefreshCw className="mr-2 h-4 w-4" /> Reenviar e-mail</>
          )}
        </Button>
        <Button onClick={confirm} className="flex-1">
          Já verifiquei
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Modo demonstração: nenhum e-mail real é enviado. O envio real será feito pelo backend em uma próxima sprint.
      </p>
    </div>
  );
}
