import { useState } from "react";
import { toast } from "sonner";
import { Laptop, MapPin, Clock, Globe, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { analyticsService } from "@/services/analyticsService";
import { maskEmail, transactionalEmailService } from "@/services/transactionalEmailService";

interface Props {
  email: string;
}

export function LoginVerificationPanel({ email }: Props) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (code.length < 4) {
      toast.error("Informe o código enviado por e-mail.");
      return;
    }
    setLoading(true);
    analyticsService.track("login_verification_submitted_mocked", { length: code.length });
    await new Promise((r) => setTimeout(r, 500));
    setLoading(false);
    toast.success("Dispositivo verificado (mock).");
  };

  const resend = async () => {
    analyticsService.track("email_resend_clicked_mocked", { eventKey: "security.verification_code" });
    await transactionalEmailService.simulateResendEmail("security.verification_code");
    toast.success("Novo código enviado (mock).");
  };

  return (
    <div className="space-y-5 rounded-2xl border border-warning/30 bg-warning/5 p-6">
      <header className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-warning/20 text-warning">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Novo dispositivo detectado</h1>
          <p className="text-xs text-muted-foreground">
            Enviamos um código para <span className="font-medium text-foreground">{maskEmail(email)}</span>
          </p>
        </div>
      </header>

      <ul className="space-y-1 text-xs text-muted-foreground">
        <li className="flex items-center gap-2"><Laptop className="h-3.5 w-3.5" /> Dispositivo: MacBook Pro (mock)</li>
        <li className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> Localização aproximada: São Paulo, BR</li>
        <li className="flex items-center gap-2"><Globe className="h-3.5 w-3.5" /> Navegador: Chrome 128</li>
        <li className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" /> Horário: {new Date().toLocaleString("pt-BR")}</li>
      </ul>

      <div className="space-y-2">
        <Label htmlFor="verification-code">Código de verificação</Label>
        <Input
          id="verification-code"
          inputMode="numeric"
          maxLength={8}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="123456"
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" onClick={resend} className="flex-1">
          Reenviar código
        </Button>
        <Button onClick={submit} disabled={loading} className="flex-1">
          {loading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificando...</>
          ) : (
            <>Verificar dispositivo</>
          )}
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Detecção real de dispositivo, geolocalização e envio de código exigem backend seguro.
      </p>
    </div>
  );
}
