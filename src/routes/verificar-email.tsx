import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { EmailInput } from "@/components/auth/EmailInput";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/providers/AuthContext";
import { friendlyAuthError } from "@/services/auth";
export const Route = createFileRoute("/verificar-email")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  component: Page,
});
function Page() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const processedTokenRef = useRef<string | null>(null);
  const { verifyEmail, resendEmailVerification, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(
    "Informe o e-mail para reenviar a confirmação ou abra o link recebido.",
  );
  useEffect(() => {
    const token = search.token;
    if (token && processedTokenRef.current !== token) {
      processedTokenRef.current = token;
      setStatus("Verificando token...");
      verifyEmail(token)
        .then(() => {
          setStatus("E-mail confirmado. Faça login para continuar.");
          toast.success("E-mail confirmado.");
        })
        .catch((e) => setStatus(friendlyAuthError(e).message))
        .finally(() => {
          navigate({ to: "/verificar-email", search: { token: undefined }, replace: true });
        });
    }
  }, [navigate, search.token, verifyEmail]);
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
