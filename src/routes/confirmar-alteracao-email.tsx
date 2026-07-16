import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEmailSecurity, friendlyAuthError } from "@/services/auth";

export const Route = createFileRoute("/confirmar-alteracao-email")({
  component: EmailChangeConfirmationPage,
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
});

function EmailChangeConfirmationPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const tokenRef = useRef<string | null>(null);
  const consumedRef = useRef(false);
  const submitInFlightRef = useRef(false);
  const { confirmEmailChange, confirmPending } = useEmailSecurity();
  const [newEmail, setNewEmail] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"error" | "info" | "success">("info");
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (search.token && !tokenRef.current && !consumedRef.current) {
      tokenRef.current = search.token;
      navigate({ to: "/confirmar-alteracao-email", search: { token: undefined }, replace: true });
    }
  }, [navigate, search.token]);

  useEffect(() => {
    return () => {
      tokenRef.current = null;
      submitInFlightRef.current = false;
    };
  }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (consumedRef.current || submitInFlightRef.current) return;
    const token = tokenRef.current;
    if (!token) {
      setMessageTone("error");
      setMessage("Token ausente ou já removido. Abra novamente o link recebido.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(newEmail)) {
      setMessageTone("error");
      setMessage("Informe o novo e-mail para validar o token.");
      return;
    }
    consumedRef.current = true;
    submitInFlightRef.current = true;
    setMessage("");
    try {
      const result = await confirmEmailChange({ token, newEmail });
      tokenRef.current = null;
      setNewEmail("");
      setMessageTone(result.status === "PENDING" ? "info" : "success");
      setMessage(
        result.status === "PENDING"
          ? "Confirmação registrada. Ainda falta a outra confirmação."
          : "E-mail alterado. Você será direcionado ao login.",
      );
    } catch (error) {
      consumedRef.current = false;
      setMessageTone("error");
      setMessage(friendlyAuthError(error).message);
      window.setTimeout(() => errorRef.current?.focus(), 0);
    } finally {
      submitInFlightRef.current = false;
    }
  };
  return (
    <main className="container-lit py-10">
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" /> Confirmar alteração de e-mail
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            O token do link é removido imediatamente da URL e fica apenas em memória. Informe o novo
            e-mail para concluir esta confirmação.
          </p>
          <p
            ref={errorRef}
            tabIndex={-1}
            aria-live="polite"
            className={`text-sm ${messageTone === "error" ? "text-destructive" : "text-muted-foreground"}`}
          >
            {message}
          </p>
          <form onSubmit={submit} noValidate className="space-y-3">
            <div>
              <Label htmlFor="confirm-change-email">Novo e-mail</Label>
              <Input
                id="confirm-change-email"
                type="email"
                autoComplete="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={confirmPending}>
              {confirmPending ? "Confirmando..." : "Confirmar alteração"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
