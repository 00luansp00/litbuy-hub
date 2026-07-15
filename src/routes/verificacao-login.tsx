import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmailInput } from "@/components/auth/EmailInput";
import { useAuth } from "@/providers/AuthProvider";
import { friendlyAuthError } from "@/services/auth";
export const Route = createFileRoute("/verificacao-login")({ component: Page });
function Page() {
  const nav = useNavigate();
  const {
    approveDevice,
    resendDeviceApproval,
    twoFactorChallenge,
    verifyTwoFactorLogin,
    resendTwoFactorLogin,
    loading,
  } = useAuth();
  const [msg, setMsg] = useState("Aguardando verificação.");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState("");
  useEffect(() => {
    const url = new URL(window.location.href);
    const token = url.searchParams.get("token");
    if (url.searchParams.get("email")) setEmail(url.searchParams.get("email")!);
    if (token) {
      setMsg("Aprovando dispositivo...");
      approveDevice(token)
        .then(
          () => setMsg("Dispositivo aprovado. Volte ao login para criar uma sessão."),
          (e) => setMsg(friendlyAuthError(e).message),
        )
        .finally(() => {
          url.searchParams.delete("token");
          window.history.replaceState(null, "", url.toString());
        });
    }
  }, [approveDevice]);
  const submit2fa = async (e: FormEvent) => {
    e.preventDefault();
    if (!twoFactorChallenge?.challengeId) {
      toast.error("Challenge ausente. Faça login novamente.");
      nav({ to: "/login" });
      return;
    }
    if (Boolean(code.trim()) === Boolean(recovery.trim()))
      return toast.error("Informe código ou recovery code, não ambos.");
    try {
      await verifyTwoFactorLogin(code ? { code } : { recoveryCode: recovery.trim().toUpperCase() });
      toast.success("Login confirmado.");
      nav({ to: "/" });
    } catch (err) {
      toast.error(friendlyAuthError(err).message);
    }
  };
  return (
    <AuthLayout
      eyebrow="Segurança"
      title={twoFactorChallenge ? "Login com 2FA" : "Aprovação de dispositivo"}
      subtitle="Fluxos reais de segurança da API NestJS."
    >
      <div className="space-y-4">
        <p aria-live="polite" className="rounded-lg border p-3 text-sm">
          {msg}
        </p>
        {twoFactorChallenge ? (
          <form onSubmit={submit2fa} className="space-y-3">
            <div>
              <Label htmlFor="code">Código de seis dígitos</Label>
              <Input
                id="code"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div>
              <Label htmlFor="recovery">Recovery code</Label>
              <Input
                id="recovery"
                placeholder="XXXXX-XXXXX-XXXXX"
                value={recovery}
                onChange={(e) => setRecovery(e.target.value.toUpperCase())}
              />
            </div>
            <Button disabled={loading} className="w-full">
              Confirmar 2FA
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() =>
                resendTwoFactorLogin().then(
                  () => toast.success("Código reenviado."),
                  (e) => toast.error(friendlyAuthError(e).message),
                )
              }
            >
              Reenviar código
            </Button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              resendDeviceApproval(email).then(
                () => setMsg("Se a conta e o dispositivo existirem, enviaremos as instruções."),
                (err) => setMsg(friendlyAuthError(err).message),
              );
            }}
            className="space-y-3"
          >
            <Label htmlFor="email">E-mail</Label>
            <EmailInput id="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button className="w-full">Reenviar aprovação</Button>
            <Button asChild variant="outline" className="w-full">
              <Link to="/login">Voltar ao login</Link>
            </Button>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}
