import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { EmailInput } from "@/components/auth/EmailInput";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/providers/AuthContext";
import { friendlyAuthError } from "@/services/auth";
import { isAdultOn } from "@/services/auth/age";
export const Route = createFileRoute("/cadastro")({ component: CadastroPage });
function requiredPublicVersion(
  name: "VITE_CURRENT_TERMS_VERSION" | "VITE_CURRENT_PRIVACY_VERSION",
) {
  const value = import.meta.env[name];
  if (value) return value;
  if (import.meta.env.DEV || import.meta.env.MODE === "test") return "2026-07-14";
  throw new Error(`${name} deve ser definido em production.`);
}
const termsVersion = requiredPublicVersion("VITE_CURRENT_TERMS_VERSION");
const privacyVersion = requiredPublicVersion("VITE_CURRENT_PRIVACY_VERSION");
function CadastroPage() {
  const { register, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 12) return toast.error("A senha precisa ter pelo menos 12 caracteres.");
    if (password !== confirm) return toast.error("As senhas não conferem.");
    if (!isAdultOn(birthDate)) return toast.error("É necessário ter pelo menos 18 anos.");
    if (!terms || !privacy) return toast.error("Aceite termos e privacidade separadamente.");
    try {
      await register({
        email,
        password,
        birthDate,
        termsAccepted: terms,
        privacyAccepted: privacy,
        termsVersion,
        privacyVersion,
        deviceName: deviceName || undefined,
      });
      toast.success("Cadastro recebido. Verifique seu e-mail para ativar a conta.");
      navigate({ to: "/verificar-email", search: { token: undefined } });
    } catch (err) {
      toast.error(friendlyAuthError(err).message);
    }
  };
  return (
    <AuthLayout
      eyebrow="Cadastro"
      title="Crie sua conta LIT Buy"
      subtitle="Cadastro real integrado à API NestJS. Nome completo virá no onboarding de perfil."
      footer={
        <>
          Já tem conta?{" "}
          <Link to="/login" className="font-medium text-foreground hover:text-primary">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <EmailInput
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="birthDate">Data de nascimento</Label>
          <Input
            id="birthDate"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="deviceName">Nome do dispositivo (opcional)</Label>
          <Input
            id="deviceName"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            maxLength={80}
            placeholder="Meu navegador"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <PasswordInput
              id="password"
              placeholder="Mínimo 12 caracteres"
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
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
        </div>
        <label className="flex gap-2 text-sm">
          <Checkbox checked={terms} onCheckedChange={(v) => setTerms(v === true)} />
          <span>
            Aceito os{" "}
            <Link to="/termos" className="underline">
              Termos
            </Link>{" "}
            ({termsVersion}).
          </span>
        </label>
        <label className="flex gap-2 text-sm">
          <Checkbox checked={privacy} onCheckedChange={(v) => setPrivacy(v === true)} />
          <span>
            Aceito a{" "}
            <Link to="/privacidade" className="underline">
              Privacidade
            </Link>{" "}
            ({privacyVersion}).
          </span>
        </label>
        <Button className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Criando...
            </>
          ) : (
            <>
              Criar conta <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
