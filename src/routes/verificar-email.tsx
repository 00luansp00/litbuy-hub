import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { EmailInput } from "@/components/auth/EmailInput";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/providers/AuthProvider";
import { friendlyAuthError } from "@/services/auth";
export const Route = createFileRoute("/verificar-email")({ component: Page });
function Page() {
  const nav = useNavigate();
  const { verifyEmail, resendEmailVerification, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(
    "Informe o e-mail para reenviar a confirmação ou abra o link recebido.",
  );
  useEffect(() => {
    const url = new URL(window.location.href);
    const token = url.searchParams.get("token");
    const mail = url.searchParams.get("email");
    if (mail) setEmail(mail);
    if (token) {
      setStatus("Verificando token...");
      verifyEmail(token)
        .then(() => {
          setStatus("E-mail confirmado. Faça login para continuar.");
          toast.success("E-mail confirmado.");
        })
        .catch((e) => setStatus(friendlyAuthError(e).message))
        .finally(() => {
          url.searchParams.delete("token");
          window.history.replaceState(null, "", url.toString());
        });
    }
  }, [verifyEmail]);
  const resend = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) return toast.error("Informe o e-mail.");
    try {
      await resendEmailVerification(email);
      setStatus("Se a conta existir, enviaremos as instruções por e-mail.");
    } catch (err) {
      setStatus(friendlyAuthError(err).message);
    }
  };
  return (
    <AuthLayout
      eyebrow="Verificação"
      title="Verifique seu e-mail"
      subtitle="Use o link enviado pela API LIT Buy."
    >
      <form onSubmit={resend} className="space-y-4">
        <p aria-live="polite" className="rounded-lg border p-3 text-sm">
          {status}
        </p>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <EmailInput id="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <Button disabled={loading} className="w-full">
          Reenviar verificação
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link to="/login">Voltar ao login</Link>
        </Button>
      </form>
    </AuthLayout>
  );
}
