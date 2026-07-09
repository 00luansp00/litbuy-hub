import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowRight, Loader2, User } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { EmailInput } from "@/components/auth/EmailInput";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/providers/AuthProvider";

export const Route = createFileRoute("/cadastro")({
  component: CadastroPage,
});

function CadastroPage() {
  const { register, loading } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [accepted, setAccepted] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      toast.error("Preencha todos os campos.");
      return;
    }
    if (password.length < 6) {
      toast.error("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não conferem.");
      return;
    }
    if (!accepted) {
      toast.error("É preciso aceitar os termos para continuar.");
      return;
    }
    try {
      const u = await register(name, email, password);
      toast.success(`Conta criada. Bem-vindo(a), ${u.name.split(" ")[0]}!`);
      navigate({ to: "/" });
    } catch {
      toast.error("Não foi possível criar sua conta. Tente novamente.");
    }
  };

  return (
    <AuthLayout
      eyebrow="Cadastro"
      title="Crie sua conta LIT Buy"
      subtitle="Comece a comprar e vender contas, gift cards, moedas e serviços com segurança."
      footer={
        <>
          Já tem uma conta?{" "}
          <Link to="/login" className="font-medium text-foreground hover:text-primary transition-colors">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="name">Nome completo</Label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="name"
              className="pl-9 bg-surface"
              placeholder="Seu nome"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
        </div>

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

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <PasswordInput
              id="password"
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirmar senha</Label>
            <PasswordInput
              id="confirm"
              placeholder="Repita a senha"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
        </div>

        <label className="flex items-start gap-2 text-sm text-muted-foreground select-none cursor-pointer">
          <Checkbox
            checked={accepted}
            onCheckedChange={(v) => setAccepted(v === true)}
            aria-label="Aceitar termos"
            className="mt-0.5"
          />
          <span>
            Concordo com os{" "}
            <Link to="/" className="text-foreground underline underline-offset-2 hover:text-primary">
              Termos de uso
            </Link>{" "}
            e a{" "}
            <Link to="/" className="text-foreground underline underline-offset-2 hover:text-primary">
              Política de privacidade
            </Link>
            .
          </span>
        </label>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Criando conta...</>
          ) : (
            <>Criar conta <ArrowRight className="h-4 w-4" /></>
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
