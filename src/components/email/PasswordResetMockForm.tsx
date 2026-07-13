import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { analyticsService } from "@/services/analyticsService";

export function PasswordResetMockForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("A senha deve ter ao menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    analyticsService.track("password_reset_completed_mocked");
    setLoading(false);
    setDone(true);
    toast.success("Senha redefinida (mock). Nenhuma senha real foi alterada.");
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-success/30 bg-success/5 p-6 text-center">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-success/20">
          <CheckCircle2 className="h-6 w-6 text-success" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Senha redefinida</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Você já pode voltar para a tela de login em modo demonstração.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="new-password">Nova senha</Label>
        <PasswordInput
          id="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirme a nova senha</Label>
        <PasswordInput
          id="confirm-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Redefinindo...</>
        ) : (
          <>Redefinir senha</>
        )}
      </Button>
      <p className="text-[11px] text-muted-foreground">
        Nenhum token é validado. Redefinição real exige backend seguro.
      </p>
    </form>
  );
}
