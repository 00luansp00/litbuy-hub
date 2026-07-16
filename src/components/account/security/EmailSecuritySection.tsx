import { useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEmailSecurity, friendlyAuthError } from "@/services/auth";

export function EmailSecuritySection({ currentEmail }: { currentEmail?: string }) {
  const { requestEmailChange } = useEmailSecurity();
  const [newEmail, setNewEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [message, setMessage] = useState("");
  const inFlight = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const fail = (m: string) => {
    setMessage(m);
    window.setTimeout(() => errorRef.current?.focus(), 0);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (inFlight.current) return;
    if (!/^\S+@\S+\.\S+$/.test(newEmail)) return fail("Informe um e-mail válido.");
    if (newEmail !== confirmEmail) return fail("A confirmação do e-mail não confere.");
    if (currentEmail && newEmail.toLowerCase() === currentEmail.toLowerCase())
      return fail("Informe um e-mail diferente do atual.");
    if (!currentPassword) return fail("Informe a senha atual.");
    inFlight.current = true;
    setMessage("");
    try {
      const response = await requestEmailChange.mutateAsync({ newEmail, currentPassword });
      setMessage(`${response.message} A alteração só termina após a dupla confirmação.`);
      setCurrentPassword("");
      setNewEmail("");
      setConfirmEmail("");
    } catch (error) {
      fail(friendlyAuthError(error).message);
    } finally {
      inFlight.current = false;
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" /> E-mail
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          E-mail atual: {currentEmail ?? "não informado"}. O novo e-mail não é gravado em URL ou
          storage.
        </p>
        <p ref={errorRef} tabIndex={-1} aria-live="polite" className="text-sm text-destructive">
          {message}
        </p>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label htmlFor="new-email">Novo e-mail</Label>
            <Input
              id="new-email"
              type="email"
              autoComplete="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="confirm-new-email">Confirmar novo e-mail</Label>
            <Input
              id="confirm-new-email"
              type="email"
              autoComplete="off"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="email-current-password">Senha da conta</Label>
            <Input
              id="email-current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={requestEmailChange.isPending}>
            {requestEmailChange.isPending
              ? "Enviando confirmações..."
              : "Solicitar alteração de e-mail"}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">
          <Link to="/confirmar-alteracao-email" className="underline">
            Abrir página de confirmação
          </Link>{" "}
          se o link de e-mail solicitar confirmação manual.
        </p>
      </CardContent>
    </Card>
  );
}
