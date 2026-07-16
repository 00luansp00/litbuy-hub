import { useEffect, useRef, useState, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { RecoveryCodeRegeneration } from "./RecoveryCodeRegeneration";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  friendlyAuthError,
  useTwoFactorSecurity,
  useTwoFactorStatus,
  normalizeRecoveryCode,
  recoveryCodePattern,
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
  const [reconcilingStatus, setReconcilingStatus] = useState(false);
  const [regenerationExclusive, setRegenerationExclusive] = useState(false);
  const mountedRef = useRef(false);
  const inFlight = useRef(false);
  const messageRef = useRef<HTMLParagraphElement>(null);
  const showingRecoveryCodes = recoveryCodes.length > 0;
  const statusReady =
    Boolean(status.data) &&
    !status.isLoading &&
    !status.isFetching &&
    !status.error &&
    !reconcilingStatus;
  const busy =
    actions.requestPending ||
    actions.confirmPending ||
    actions.disablePending ||
    actions.disableConfirmPending ||
    regenerationExclusive ||
    inFlight.current ||
    reconcilingStatus;

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
    if (busy || showingRecoveryCodes || !statusReady) return;
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

  const reconcileMalformedEnrollment = async () => {
    setReconcilingStatus(true);
    try {
      await status.refetch();
      if (mountedRef.current) {
        fail(
          "O 2FA pode ter sido ativado, mas não foi possível exibir os recovery codes. Consulte o status da conta.",
        );
      }
    } finally {
      if (mountedRef.current) setReconcilingStatus(false);
    }
  };

  const resendEnrollment = async () => {
    if (busy || !challenge?.method || !challenge.currentPassword || showingRecoveryCodes) return;
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
    if (busy || !challenge || showingRecoveryCodes || !statusReady) return;
    if (!/^\d{6}$/.test(code)) return fail("Informe o código de seis dígitos.");
    inFlight.current = true;
    setMessage("");
    try {
      const result = await actions.confirmEnrollment({ challengeId: challenge.challengeId, code });
      if (!mountedRef.current) return;
      setRecoveryCodes(result.recoveryCodes);
      setChallenge(null);
      setCode("");
      setPassword("");
      inform("2FA ativado. Guarde seus recovery codes agora.");
      void actions.refreshTwoFactorRelatedData();
    } catch (error) {
      if (!mountedRef.current) return;
      setChallenge(null);
      setCode("");
      setPassword("");
      if (error instanceof ApiError && error.code === "MALFORMED_RESPONSE") {
        void reconcileMalformedEnrollment();
      } else fail(friendlyAuthError(error).message);
    } finally {
      inFlight.current = false;
    }
  };

  const closeRecoveryCodes = async () => {
    if (!acknowledged) return;
    setReconcilingStatus(true);
    setRecoveryCodes([]);
    setAcknowledged(false);
    setClipboardState("");
    try {
      const result = await status.refetch();
      if (!mountedRef.current) return;
      if (result.error) {
        fail(friendlyAuthError(result.error).message);
        return;
      }
      setReconcilingStatus(false);
    } catch (error) {
      if (mountedRef.current) fail(friendlyAuthError(error).message);
    }
  };

  const copyRecoveryCodes = async () => {
    setClipboardState("");
    try {
      if (!navigator.clipboard?.writeText) {
        if (mountedRef.current) setClipboardState("Clipboard indisponível neste navegador.");
        return;
      }
      await navigator.clipboard.writeText(recoveryCodes.join("\n"));
      if (mountedRef.current) setClipboardState("Códigos copiados.");
    } catch {
      if (mountedRef.current) setClipboardState("Não foi possível copiar os códigos.");
    }
  };

  const requestDisable = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || showingRecoveryCodes || !statusReady) return;
    if (!disablePassword) return fail("Informe a senha atual.");
    if (!disableAccepted) return fail("Confirme que entende o risco de desativar o 2FA.");
    inFlight.current = true;
    setMessage("");
    try {
      const response = await actions.requestDisable({ currentPassword: disablePassword });
      if (!mountedRef.current) return;
      setDisableChallenge({ ...response, currentPassword: disablePassword });
      setDisablePassword("");
      inform("Código de desativação enviado.");
    } catch (error) {
      if (mountedRef.current) fail(friendlyAuthError(error).message);
    } finally {
      inFlight.current = false;
    }
  };

  const resendDisable = async () => {
    if (busy || !disableChallenge?.currentPassword || showingRecoveryCodes || !statusReady) return;
    const currentPassword = disableChallenge.currentPassword;
    inFlight.current = true;
    setMessage("");
    try {
      const response = await actions.requestDisable({ currentPassword });
      if (!mountedRef.current) return;
      setDisableChallenge({ ...response, currentPassword });
      setDisableCode("");
      setDisableRecovery("");
      inform("Novo código de desativação enviado.");
    } catch (error) {
      if (mountedRef.current) fail(friendlyAuthError(error).message);
    } finally {
      inFlight.current = false;
    }
  };

  const confirmDisable = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !disableChallenge || showingRecoveryCodes || !statusReady) return;
    const hasCodeInput = disableCode.length > 0;
    const hasRecoveryInput = disableRecovery.trim().length > 0;
    if (hasCodeInput && hasRecoveryInput) {
      return fail("Use apenas o código ou o recovery code, nunca ambos.");
    }
    if (!hasCodeInput && !hasRecoveryInput) {
      return fail("Informe o código ou um recovery code.");
    }
    if (hasCodeInput && !/^\d{6}$/.test(disableCode)) {
      return fail("Informe o código de seis dígitos.");
    }
    const normalizedRecovery = normalizeRecoveryCode(disableRecovery);
    const hasRecovery = recoveryCodePattern.test(normalizedRecovery);
    if (hasRecoveryInput && !hasRecovery) {
      return fail("Informe um recovery code no formato XXXXX-XXXXX-XXXXX.");
    }
    inFlight.current = true;
    setMessage("");
    try {
      if (hasCodeInput)
        await actions.confirmDisable({
          challengeId: disableChallenge.challengeId,
          code: disableCode,
        });
      else
        await actions.confirmDisable({
          challengeId: disableChallenge.challengeId,
          recoveryCode: normalizedRecovery,
        });
    } catch (error) {
      if (mountedRef.current) fail(friendlyAuthError(error).message);
    } finally {
      inFlight.current = false;
    }
  };

  const retryStatus = async () => {
    setMessage("");
    setReconcilingStatus(true);
    await status.refetch().catch((error) => {
      if (mountedRef.current) fail(friendlyAuthError(error).message);
    });
    if (mountedRef.current) setReconcilingStatus(false);
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
        {reconcilingStatus && (
          <p className="text-sm text-muted-foreground">Verificando o status real do 2FA...</p>
        )}
        {status.error && (
          <div role="alert" className="space-y-2 text-sm text-destructive">
            <p>{friendlyAuthError(status.error).message}</p>
            <Button type="button" variant="outline" onClick={() => void retryStatus()}>
              Tentar novamente
            </Button>
          </div>
        )}
        {status.data && (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Status:{" "}
              {status.data.enabled
                ? `ativo por ${status.data.method}, desde ${formatDate(status.data.enabledAt)}. Recovery codes restantes: ${status.data.recoveryCodesRemaining}.`
                : "inativo."}
            </p>
            {status.data.enabled && status.data.recoveryCodesRemaining === 0 && (
              <p className="font-medium text-destructive">
                Você não possui recovery codes restantes. Regenere um novo conjunto seguro.
              </p>
            )}
            {status.data.enabled &&
              status.data.recoveryCodesRemaining > 0 &&
              status.data.recoveryCodesRemaining <= 2 && (
                <p className="font-medium text-amber-600">
                  Restam poucos recovery codes. Considere regenerar um novo conjunto seguro.
                </p>
              )}
          </div>
        )}
        <p
          ref={messageRef}
          tabIndex={-1}
          aria-live="polite"
          className={`text-sm ${tone === "error" ? "text-destructive" : "text-muted-foreground"}`}
        >
          {message}
        </p>
        {statusReady && !status.data?.enabled && !challenge && (
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
            <Button type="submit" disabled={busy}>
              {actions.requestPending ? "Enviando..." : "Ativar 2FA"}
            </Button>
          </form>
        )}
        {statusReady && challenge && (
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
            <Button type="submit" disabled={busy}>
              {actions.confirmPending ? "Confirmando..." : "Confirmar ativação"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void resendEnrollment()}
            >
              {actions.requestPending ? "Reenviando..." : "Reenviar código"}
            </Button>
          </form>
        )}
        {statusReady && status.data?.enabled && !disableChallenge && (
          <RecoveryCodeRegeneration
            disabled={busy || showingRecoveryCodes}
            onExclusiveChange={setRegenerationExclusive}
          />
        )}
        {statusReady && status.data?.enabled && !disableChallenge && !regenerationExclusive && (
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
            <Button type="submit" variant="destructive" disabled={busy}>
              {actions.disablePending ? "Solicitando..." : "Solicitar desativação"}
            </Button>
          </form>
        )}
        {statusReady && disableChallenge && !regenerationExclusive && (
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
                onChange={(e) => setDisableRecovery(normalizeRecoveryCode(e.target.value))}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="destructive" disabled={busy}>
                {actions.disableConfirmPending ? "Desativando..." : "Confirmar desativação"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void resendDisable()}
              >
                {actions.disablePending ? "Reenviando..." : "Reenviar código de desativação"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
