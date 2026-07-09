import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { EmailInput } from "@/components/auth/EmailInput";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/providers/AuthProvider";

export const Route = createFileRoute("/recuperar-senha")({
  component: RecuperarSenhaPage,
});

function RecuperarSenhaPage() {
  const { requestPasswordReset, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Informe seu email.");
      return;
    }
    try {
      await requestPasswordReset(email);
      setSent(true);
      toast.success("Enviamos as instruções para o seu email.");
    } catch {
      toast.error("Não foi possível enviar as instruções.");
    }
  };

  return (
    <AuthLayout
      eyebrow="Recuperação"
      title="Recuperar acesso"
      subtitle="Digite o email associado à sua conta e enviaremos um link seguro para redefinir sua senha."
      footer={
        <>
          Lembrou a senha?{" "}
          <Link to="/login" className="font-medium text-foreground hover:text-primary transition-colors">
            Voltar para o login
          </Link>
        </>
      }
    >
      {sent ? (
        <div className="rounded-xl border border-border bg-surface/70 p-6 text-center">
          <div
            className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full"
            style={{ backgroundImage: "var(--gradient-primary)" }}
          >
            <CheckCircle2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <p className="text-sm text-foreground">
            Se existir uma conta para <span className="font-medium">{email}</span>, você receberá as
            instruções em instantes.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Verifique também a caixa de spam ou promoções.
          </p>
          <Button asChild variant="outline" className="mt-5 w-full">
            <Link to="/login">
              <Mail className="h-4 w-4" /> Voltar para o login
            </Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">Email cadastrado</Label>
            <EmailInput
              id="email"
              placeholder="voce@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
            ) : (
              <>Enviar instruções</>
            )}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
