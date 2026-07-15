import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { EmailInput } from "@/components/auth/EmailInput";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/providers/AuthProvider";
import { friendlyAuthError } from "@/services/auth";
export const Route = createFileRoute("/login")({ component: LoginPage });
function LoginPage() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Preencha email e senha para continuar.");
      return;
    }
    try {
      const r = await login(email, password);
      if (r.status === "authenticated") {
        toast.success(`Bem-vindo(a), ${r.user.displayName}!`);
        navigate({ to: "/" });
      } else if (r.status === "deviceApprovalRequired") {
        toast.info("Aprove este dispositivo pelo link enviado ao seu e-mail.");
        navigate({ to: "/verificacao-login", search: { email, mode: "device" } as never });
      } else if (r.status === "twoFactorRequired") {
        toast.info("Informe seu código de verificação para concluir o login.");
        navigate({ to: "/verificacao-login", search: { mode: "2fa" } as never });
      }
    } catch (err) {
      toast.error(friendlyAuthError(err).message);
    }
  };
  return (
    <AuthLayout
      eyebrow="Acesso"
      title="Entrar na LIT Buy"
      subtitle="Use sua conta real conectada à API LIT Buy."
      footer={
        <>
          Ainda não tem conta?{" "}
          <Link to="/cadastro" className="font-medium text-foreground hover:text-primary">
            Criar conta
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <EmailInput
            id="email"
            placeholder="voce@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Senha</Label>
            <Link
              to="/recuperar-senha"
              className="text-xs font-medium text-muted-foreground hover:text-primary"
            >
              Esqueceu sua senha?
            </Link>
          </div>
          <PasswordInput
            id="password"
            placeholder="Sua senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Entrando...
            </>
          ) : (
            <>
              Entrar <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
        <p aria-live="polite" className="text-center text-xs text-muted-foreground">
          O access token fica somente em memória; cookies seguros são controlados pela API.
        </p>
      </form>
    </AuthLayout>
  );
}
