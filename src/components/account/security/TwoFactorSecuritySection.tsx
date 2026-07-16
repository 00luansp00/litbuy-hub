import { useEffect, useRef, useState, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  friendlyAuthError,
  useTwoFactorSecurity,
  useTwoFactorStatus,
  type TwoFactorMethod,
} from "@/services/auth";

type Challenge = {
  challengeId: string;
  expiresAt: string;
  method?: TwoFactorMethod;
  currentPassword?: string;
};

type Tone = "error" | "info" | "success";

function formatDate(value: string | null) {
  if (!value) return "Não informado";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Não informado" : date.toLocaleString("pt-BR");
}

export function TwoFactorSecuritySection({ smsAvailable }: { smsAvailable: boolean }) {
  const status = useTwoFactorStatus(true);
  const actions = useTwoFactorSecurity();
  const [method, setMethod] = useState<TwoFactorMethod>("EMAIL");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableAccepted, setDisableAccepted] = useState(false);
  const [disableChallenge, setDisableChallenge] = useState<Challenge | null>(null);
  const [disableCode, setDisableCode] = useState("");
  const [disableRecovery, setDisableRecovery] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [clipboardState, setClipboardState] = useState("");
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<Tone>("info");
  const mountedRef = useRef(false);
  const inFlight = useRef(false);
  const messageRef = useRef<HTMLParagraphElement>(null);
  const showingRecoveryCodes = recoveryCodes.length > 0;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fail = (text: string) => {
    setTone("error");
    setMessage(text);
    window.setTimeout(() => messageRef.current?.focus(), 0);
  };
  const inform = (text: string, nextTone: Tone = "success") => {
    setTone(nextTone);
    setMessage(text);
  };

  const requestEnrollment = async (event?: FormEvent) => {
    event?.preventDefault();
    if (inFlight.current || showingRecoveryCodes) return;
    if (method === "SMS" && !smsAvailable)
      return fail("Ativação por SMS indisponível até confirmar um telefone.");
    if (!password) return fail("Informe a senha atual.");
    inFlight.current = true;
    setMessage("");
    try {
      const response = await actions.requestEnrollment({ method, currentPassword: password });
      if (!mountedRef.current) return;
      setChallenge({ ...response, method, currentPassword: password });
      setCode("");
      setPassword("");
      inform("Código enviado. O challenge fica apenas em memória.");
    } catch (error) {
      if (mountedRef.current) fail(friendlyAuthError(error).message);
    } finally {
      inFlight.current = false;
    }
  };

  const resendEnrollment = async () => {
    if (
      inFlight.current ||
      !challenge?.method ||
      !challenge.currentPassword ||
      showingRecoveryCodes
    )
      return;
    const currentMethod = challenge.method;
    const currentPassword = challenge.currentPassword;
    inFlight.current = true;
    setMessage("");
    try {
      const response = await actions.requestEnrollment({
        method: currentMethod,
        currentPassword,
      });
      if (!mountedRef.current) return;
      setChallenge({ ...response, method: currentMethod, currentPassword });
      setCode("");
      inform("Novo código enviado.");
    } catch (error) {
      if (mountedRef.current) fail(friendlyAuthError(error).message);
    } finally {
      inFlight.current = false;
    }
  };

  const confirmEnrollment = async (event: FormEvent) => {
    event.preventDefault();
    if (inFlight.current || !challenge || showingRecoveryCodes) return;
    if (!/^\d{6}$/.test(code)) return fail("Informe o código de seis dígitos.");
    inFlight.current = true;
    setMessage("");
    try {
      const result = await actions.confirmEnrollment({ challengeId: challenge.challengeId, code });
      if (!mountedRef.current) return;
      setRecoveryCodes(result.recoveryCodes);
      setChallenge(null);
      setCode("");
      inform("2FA ativado. Guarde seus recovery codes agora.");
    } catch (error) {
      if (!mountedRef.current) return;
      setChallenge(null);
      setCode("");
      if (error instanceof ApiError && error.code === "MALFORMED_RESPONSE") {
        fail(
          "O 2FA pode ter sido ativado, mas não foi possível exibir os recovery codes. Consulte o status da conta.",
        );
      } else fail(friendlyAuthError(error).message);
    } finally {
      inFlight.current = false;
    }
  };

  const closeRecoveryCodes = async () => {
    if (!acknowledged) return;
    setRecoveryCodes([]);
    setAcknowledged(false);
    setClipboardState("");
    await status.refetch().catch(() => undefined);
  };

  const copyRecoveryCodes = async () => {
    setClipboardState("");
    try {
      if (!navigator.clipboard?.writeText) {
        setClipboardState("Clipboard indisponível neste navegador.");
        return;
      }
      await navigator.clipboard.writeText(recoveryCodes.join("\n"));
      setClipboardState("Códigos copiados.");
    } catch {
      setClipboardState("Não foi possível copiar os códigos.");
    }
  };

  const requestDisable = async (event: FormEvent) => {
    event.preventDefault();
    if (inFlight.current || showingRecoveryCodes) return;
    if (!disablePassword) return fail("Informe a senha atual.");
    if (!disableAccepted) return fail("Confirme que entende o risco de desativar o 2FA.");
    inFlight.current = true;
    setMessage("");
    try {
      const response = await actions.requestDisable({ currentPassword: disablePassword });
      if (!mountedRef.current) return;
      setDisableChallenge(response);
      setDisablePassword("");
      inform("Código de desativação enviado.");
    } catch (error) {
      if (mountedRef.current) fail(friendlyAuthError(error).message);
    } finally {
      inFlight.current = false;
    }
  };

  const confirmDisable = async (event: FormEvent) => {
    event.preventDefault();
    if (inFlight.current || !disableChallenge || showingRecoveryCodes) return;
    const hasCode = /^\d{6}$/.test(disableCode);
    const hasRecovery = disableRecovery.trim().length > 0;
    if (hasCode === hasRecovery)
      return fail("Informe código de seis dígitos ou recovery code, nunca ambos.");
    inFlight.current = true;
    setMessage("");
    try {
      if (hasCode)
        await actions.confirmDisable({
          challengeId: disableChallenge.challengeId,
          code: disableCode,
        });
      else
        await actions.confirmDisable({
          challengeId: disableChallenge.challengeId,
          recoveryCode: disableRecovery.trim(),
        });
    } catch (error) {
      if (mountedRef.current) fail(friendlyAuthError(error).message);
    } finally {
      inFlight.current = false;
    }
  };

  if (showingRecoveryCodes) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" /> Recovery codes do 2FA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Esta é a única exibição. Guarde exatamente estes códigos antes de fechar.
          </p>
          <ul className="grid gap-2 rounded-2xl border p-4 font-mono text-sm">
            {recoveryCodes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <Button type="button" variant="outline" onClick={() => void copyRecoveryCodes()}>
            Copiar todos
          </Button>
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {clipboardState}
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
            />{" "}
            Confirmei que guardei meus códigos
          </label>
          <Button type="button" disabled={!acknowledged} onClick={() => void closeRecoveryCodes()}>
            Fechar recovery codes
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" /> Autenticação em dois fatores
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {status.isLoading && (
          <p className="text-sm text-muted-foreground">Carregando status real do 2FA...</p>
        )}
        {status.error && (
          <p role="alert" className="text-sm text-destructive">
            {friendlyAuthError(status.error).message}
          </p>
        )}
        {status.data && (
          <p className="text-sm text-muted-foreground">
            Status:{" "}
            {status.data.enabled
              ? `ativo por ${status.data.method}, desde ${formatDate(status.data.enabledAt)}. Recovery codes restantes: ${status.data.recoveryCodesRemaining}.`
              : "inativo."}
          </p>
        )}
        <p
          ref={messageRef}
          tabIndex={-1}
          aria-live="polite"
          className={`text-sm ${tone === "error" ? "text-destructive" : "text-muted-foreground"}`}
        >
          {message}
        </p>
        {!status.data?.enabled && !challenge && (
          <form onSubmit={requestEnrollment} className="space-y-3">
            <div>
              <Label htmlFor="two-factor-method">Método</Label>
              <select
                id="two-factor-method"
                className="w-full rounded-md border bg-background p-2"
                value={method}
                onChange={(e) => setMethod(e.target.value as TwoFactorMethod)}
              >
                <option value="EMAIL">E-mail</option>
                <option value="SMS" disabled={!smsAvailable}>
                  SMS{smsAvailable ? "" : " indisponível"}
                </option>
              </select>
            </div>
            <div>
              <Label htmlFor="two-factor-password">Senha da conta</Label>
              <Input
                id="two-factor-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={actions.requestPending}>
              {actions.requestPending ? "Enviando..." : "Ativar 2FA"}
            </Button>
          </form>
        )}
        {challenge && (
          <form onSubmit={confirmEnrollment} className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Código enviado. Expira em {formatDate(challenge.expiresAt)}.
            </p>
            <div>
              <Label htmlFor="two-factor-code">Código de seis dígitos</Label>
              <Input
                id="two-factor-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </div>
            <Button type="submit" disabled={actions.confirmPending}>
              {actions.confirmPending ? "Confirmando..." : "Confirmar ativação"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={actions.requestPending}
              onClick={() => void resendEnrollment()}
            >
              {actions.requestPending ? "Reenviando..." : "Reenviar código"}
            </Button>
          </form>
        )}
        {status.data?.enabled && !disableChallenge && (
          <form onSubmit={requestDisable} className="space-y-3 rounded-2xl border p-4">
            <p className="text-sm text-destructive">
              Desativar o 2FA reduz a proteção da conta e revogará as sessões.
            </p>
            <div>
              <Label htmlFor="disable-two-factor-password">Senha da conta</Label>
              <Input
                id="disable-two-factor-password"
                type="password"
                autoComplete="current-password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={disableAccepted}
                onChange={(e) => setDisableAccepted(e.target.checked)}
              />{" "}
              Entendo o risco de desativar o 2FA
            </label>
            <Button type="submit" variant="destructive" disabled={actions.disablePending}>
              {actions.disablePending ? "Solicitando..." : "Solicitar desativação"}
            </Button>
          </form>
        )}
        {disableChallenge && (
          <form onSubmit={confirmDisable} className="space-y-3 rounded-2xl border p-4">
            <p className="text-sm text-muted-foreground">
              Confirme com código de seis dígitos ou recovery code.
            </p>
            <div>
              <Label htmlFor="disable-two-factor-code">Código</Label>
              <Input
                id="disable-two-factor-code"
                inputMode="numeric"
                maxLength={6}
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </div>
            <div>
              <Label htmlFor="disable-two-factor-recovery">Recovery code</Label>
              <Input
                id="disable-two-factor-recovery"
                value={disableRecovery}
                onChange={(e) => setDisableRecovery(e.target.value)}
              />
            </div>
            <Button type="submit" variant="destructive" disabled={actions.disableConfirmPending}>
              {actions.disableConfirmPending ? "Desativando..." : "Confirmar desativação"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
