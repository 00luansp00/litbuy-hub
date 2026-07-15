import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/providers/AuthContext";
import { friendlyAuthError } from "@/services/auth";
export const Route = createFileRoute("/redefinir-senha")({ component: Page });
function Page() {
  const nav = useNavigate();
  const { resetPassword, loading } = useAuth();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  useEffect(() => {
    const u = new URL(window.location.href);
    const t = u.searchParams.get("token") ?? "";
    setToken(t);
    if (t) {
      u.searchParams.delete("token");
      window.history.replaceState(null, "", u.toString());
    }
  }, []);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return toast.error("Token ausente ou expirado.");
    if (password.length < 12) return toast.error("A senha precisa ter pelo menos 12 caracteres.");
    if (password !== confirm) return toast.error("As senhas não conferem.");
    try {
      await resetPassword(token, password);
      toast.success("Senha redefinida. Faça login novamente.");
      nav({ to: "/login" });
    } catch (err) {
      toast.error(friendlyAuthError(err).message);
    }
  };
  return (
    <AuthLayout
      eyebrow="Segurança"
      title="Redefinir senha"
      subtitle="Escolha uma nova senha forte."
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="password">Nova senha</Label>
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <div>
          <Label htmlFor="confirm">Confirmar senha</Label>
          <PasswordInput
            id="confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <Button disabled={loading} className="w-full">
          Redefinir senha
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link to="/login">Voltar ao login</Link>
        </Button>
      </form>
    </AuthLayout>
  );
}
