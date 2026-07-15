import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { EmailInput } from "@/components/auth/EmailInput";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/providers/AuthContext";
import { friendlyAuthError } from "@/services/auth";
export const Route = createFileRoute("/recuperar-senha")({ component: Page });
function Page() {
  const { requestPasswordReset, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) return toast.error("Informe seu email.");
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      toast.error(friendlyAuthError(err).message);
    }
  };
  return (
    <AuthLayout
      eyebrow="Recuperação"
      title="Recuperar acesso"
      subtitle="A resposta é sempre genérica para proteger sua conta."
      footer={
        <>
          Lembrou a senha?{" "}
          <Link to="/login" className="font-medium text-foreground hover:text-primary">
            Voltar
          </Link>
        </>
      }
    >
      {sent ? (
        <div className="rounded-xl border p-6 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-8 w-8" />
          <p>Se existir uma conta para este e-mail, enviaremos as instruções.</p>
          <Button asChild className="mt-4">
            <Link to="/login">
              <Mail className="mr-2 h-4 w-4" /> Login
            </Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Label htmlFor="email">Email cadastrado</Label>
          <EmailInput
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Button className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Enviando...
              </>
            ) : (
              "Enviar instruções"
            )}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
