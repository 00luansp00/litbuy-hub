import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { verificationService } from "@/services/verificationService";
import { VerificationSecurityNotice } from "./VerificationSecurityNotice";

interface Props {
  onContinue: () => void;
}

export function VerificationSmsStep({ onContinue }: Props) {
  const [phone, setPhone] = useState("+55 11 90000-0000");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);

  const send = async () => {
    const r = await verificationService.simulateSendSmsCode(phone);
    setSent(true);
    toast.success("Código enviado (mock)", { description: `Para ${r.masked}` });
  };

  const verify = async () => {
    const r = await verificationService.simulateVerifySmsCode(code);
    if (r.ok) {
      toast.success("Telefone verificado (mock)");
      onContinue();
    } else {
      toast.error("Código inválido");
    }
  };

  return (
    <div className="space-y-4">
      <VerificationSecurityNotice variant="compact" />
      <div>
        <Label htmlFor="v-phone">Telefone (demonstrativo)</Label>
        <div className="mt-1 flex gap-2">
          <Input id="v-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Button type="button" variant="outline" onClick={send}>
            Enviar código
          </Button>
        </div>
      </div>
      {sent && (
        <div>
          <Label htmlFor="v-code">Código recebido</Label>
          <div className="mt-1 flex gap-2">
            <Input id="v-code" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} />
            <Button type="button" onClick={verify}>
              Validar código
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
