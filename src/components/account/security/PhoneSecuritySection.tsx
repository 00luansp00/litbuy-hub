import { useRef, useState, type FormEvent } from "react";
import { Smartphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePhoneSecurity, friendlyAuthError } from "@/services/auth";

type Challenge = { challengeId: string; expiresAt: string; phone: string };
const obviousBrazilianMobile = (value: string) =>
  value.replace(/\D/g, "").replace(/^55/, "").length === 11 &&
  value.replace(/\D/g, "").replace(/^55/, "")[2] === "9";

export function PhoneSecuritySection({
  phoneMasked,
  phoneVerified,
}: {
  phoneMasked?: string | null;
  phoneVerified: boolean;
}) {
  const { requestPhone, verifyPhone } = usePhoneSecurity();
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [message, setMessage] = useState("");
  const inFlight = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const fail = (m: string) => {
    setMessage(m);
    window.setTimeout(() => errorRef.current?.focus(), 0);
  };
  const submitRequest = async (event: FormEvent) => {
    event.preventDefault();
    if (inFlight.current) return;
    if (!phone.trim()) return fail("Informe o telefone.");
    if (!obviousBrazilianMobile(phone)) return fail("Informe um celular brasileiro válido.");
    if (!currentPassword) return fail("Informe a senha atual.");
    inFlight.current = true;
    setMessage("");
    try {
      const response = await requestPhone.mutateAsync({ phone, currentPassword });
      setChallenge({ challengeId: response.challengeId, expiresAt: response.expiresAt, phone });
      setCode("");
      setMessage("Código enviado por SMS. O prazo exibido vem da API.");
    } catch (error) {
      fail(friendlyAuthError(error).message);
    } finally {
      inFlight.current = false;
    }
  };
  const submitVerify = async (event: FormEvent) => {
    event.preventDefault();
    if (inFlight.current || !challenge) return;
    if (!/^\d{6}$/.test(code)) return fail("Informe o código SMS de seis dígitos.");
    inFlight.current = true;
    setMessage("");
    try {
      await verifyPhone.mutateAsync({
        challengeId: challenge.challengeId,
        phone: challenge.phone,
        code,
      });
    } catch (error) {
      fail(friendlyAuthError(error).message);
    } finally {
      inFlight.current = false;
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" /> Telefone
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Status:{" "}
          {phoneVerified ? `confirmado${phoneMasked ? ` (${phoneMasked})` : ""}` : "não confirmado"}
          . O telefone e o challenge ficam só em memória.
        </p>
        <p ref={errorRef} tabIndex={-1} aria-live="polite" className="text-sm text-destructive">
          {message}
        </p>
        {!challenge ? (
          <form onSubmit={submitRequest} className="space-y-3">
            <div>
              <Label htmlFor="secure-phone">Telefone celular</Label>
              <Input
                id="secure-phone"
                autoComplete="tel"
                inputMode="tel"
                placeholder="(17) 99999-1234"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="phone-current-password">Senha da conta</Label>
              <Input
                id="phone-current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={requestPhone.isPending}>
              {" "}
              {requestPhone.isPending ? "Enviando SMS..." : "Enviar código SMS"}
            </Button>
          </form>
        ) : (
          <form onSubmit={submitVerify} className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Challenge recebido. Expira em {new Date(challenge.expiresAt).toLocaleString("pt-BR")}.
            </p>
            <div>
              <Label htmlFor="phone-code">Código SMS</Label>
              <Input
                id="phone-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={verifyPhone.isPending}>
                {verifyPhone.isPending ? "Confirmando..." : "Confirmar telefone"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setChallenge(null)}
                disabled={verifyPhone.isPending}
              >
                Voltar
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
