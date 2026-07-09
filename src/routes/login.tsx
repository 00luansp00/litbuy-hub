import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { EmailInput } from "@/components/auth/EmailInput";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/providers/AuthProvider";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Preencha email e senha para continuar.");
      return;
    }
    try {
      const u = await login(email, password);
      toast.success(`Bem-vindo(a) de volta, ${u.name.split(" ")[0]}!`);
      navigate({ to: "/" });
    } catch {
      toast.error("Não foi possível entrar. Tente novamente.");
    }
  };

  return (
    <AuthLayout
      eyebrow="Acesso"
      title="Entrar na LIT Buy"
      subtitle="Continue de onde parou — sua carteira, pedidos e favoritos esperam."
      footer={
        <>
          Ainda não tem conta?{" "}
          <Link to="/cadastro" className="font-medium text-foreground hover:text-primary transition-colors">
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
              className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
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

        <label className="flex items-center gap-2 text-sm text-muted-foreground select-none cursor-pointer">
          <Checkbox
            checked={remember}
            onCheckedChange={(v) => setRemember(v === true)}
            aria-label="Lembrar-me"
          />
          Lembrar-me neste dispositivo
        </label>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Entrando...</>
          ) : (
            <>Entrar <ArrowRight className="h-4 w-4" /></>
          )}
        </Button>

        <Button asChild type="button" variant="outline" className="w-full">
          <Link to="/cadastro">Criar conta gratuita</Link>
        </Button>
      </form>
    </AuthLayout>
  );
}
