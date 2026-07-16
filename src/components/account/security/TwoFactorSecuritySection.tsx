import { useEffect, useRef, useState, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useTwoFactorSecurityActions,
  useTwoFactorStatus,
  friendlyAuthError,
} from "@/services/auth";
import type { TwoFactorMethod } from "@/services/auth";

type Challenge = {
  challengeId: string;
  expiresAt: string;
  method?: TwoFactorMethod;
  currentPassword: string;
};

type Tone = "error" | "info" | "success";

function formatDate(value: string | null | undefined) {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function normalizeRecoveryCode(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 15)
    .replace(/(.{5})(?=.)/g, "$1-");
}

function RecoveryCodesDisplay({ codes, onClose }: { codes: string[]; onClose: () => void }) {
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyAll = async () => {
    await navigator.clipboard?.writeText(codes.join("\n"));
    setCopied(true);
  };
  return (
    <Card className="border-amber-300 bg-amber-50/60">
      <CardHeader>
        <CardTitle>Recovery codes do 2FA</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Estes códigos aparecem uma única vez. Guarde-os em um local seguro antes de fechar.
        </p>
        <ul aria-label="Recovery codes" className="grid gap-2 sm:grid-cols-2">
          {codes.map((code) => (
            <li key={code} className="rounded border bg-background p-2 font-mono text-sm">
              {code}
            </li>
          ))}
        </ul>
        <Button type="button" variant="outline" onClick={() => void copyAll()}>
          Copiar todos
        </Button>
        {copied && (
          <p className="text-sm text-muted-foreground">Códigos copiados por ação do usuário.</p>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          Confirmei que guardei meus códigos
        </label>
        <Button type="button" disabled={!confirmed} onClick={onClose}>
          Fechar códigos
        </Button>
      </CardContent>
    </Card>
  );
}

export function TwoFactorSecuritySection({
  isAuthenticated,
  emailVerified,
  phoneVerified,
}: {
  isAuthenticated: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
}) {
  const status = useTwoFactorStatus(isAuthenticated);
  const actions = useTwoFactorSecurityActions();
  const [method, setMethod] = useState<TwoFactorMethod>("EMAIL");
  const [password, setPassword] = useState("");
  const [enrollChallenge, setEnrollChallenge] = useState<Challenge | null>(null);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableConfirmed, setDisableConfirmed] = useState(false);
  const [disableChallenge, setDisableChallenge] = useState<Challenge | null>(null);
  const [code, setCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<Tone>("info");
  const mountedRef = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const busy =
    actions.enrollRequestPending ||
    actions.enrollConfirmPending ||
    actions.disableRequestPending ||
    actions.disableConfirmPending;

  const fail = (error: unknown) => {
    setTone("error");
    setMessage(typeof error === "string" ? error : friendlyAuthError(error).message);
    window.setTimeout(() => errorRef.current?.focus(), 0);
  };

  const requestEnrollment = async (event?: FormEvent) => {
    event?.preventDefault();
    if (busy) return;
    if (!password) return fail("Informe a senha atual.");
    setMessage("");
    try {
      const currentPassword = password;
      const response = await actions.requestEnrollment({ method, currentPassword });
      if (!mountedRef.current) return;
      setEnrollChallenge({ ...response, method, currentPassword });
      setPassword("");
      setCode("");
      setTone("info");
      setMessage("Código enviado. Informe-o para ativar o 2FA.");
    } catch (error) {
      if (mountedRef.current) fail(error);
    }
  };

  const resendEnrollment = async () => {
    if (busy) return;
    const current = enrollChallenge;
    if (!current?.method) return;
    const currentMethod = current.method;
    setMessage("");
    try {
      const response = await actions.requestEnrollment({
        method: currentMethod,
        currentPassword: current.currentPassword,
      });
      if (!mountedRef.current) return;
      setEnrollChallenge({ ...current, ...response });
      setCode("");
      setTone("info");
      setMessage("Novo código enviado.");
    } catch (error) {
      if (mountedRef.current) fail(error);
    }
  };

  const confirmEnrollment = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !enrollChallenge) return;
    if (!/^\d{6}$/.test(code)) return fail("Informe o código de seis dígitos.");
    setMessage("");
    try {
      const response = await actions.confirmEnrollment({
        challengeId: enrollChallenge.challengeId,
        code,
      });
      if (!mountedRef.current) return;
      setEnrollChallenge(null);
      setCode("");
      setRecoveryCodes(response.recoveryCodes);
      setTone("success");
      setMessage("2FA ativado. Guarde os recovery codes antes de continuar.");
    } catch (error) {
      if (mountedRef.current) fail(error);
    }
  };

  const requestDisable = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!disablePassword) return fail("Informe a senha atual.");
    if (!disableConfirmed) return fail("Confirme que entende o risco de desativar o 2FA.");
    setMessage("");
    try {
      const currentPassword = disablePassword;
      const response = await actions.requestDisable({ currentPassword });
      if (!mountedRef.current) return;
      setDisableChallenge({ ...response, currentPassword });
      setDisablePassword("");
      setDisableCode("");
      setRecoveryCode("");
      setTone("info");
      setMessage("Código enviado. Confirme para desativar o 2FA.");
    } catch (error) {
      if (mountedRef.current) fail(error);
    }
  };

  const resendDisable = async () => {
    if (busy || !disableChallenge) return;
    const current = disableChallenge;
    setMessage("");
    try {
      const response = await actions.requestDisable({ currentPassword: current.currentPassword });
      if (!mountedRef.current) return;
      setDisableChallenge({ ...current, ...response });
      setDisableCode("");
      setRecoveryCode("");
      setTone("info");
      setMessage("Novo código enviado.");
    } catch (error) {
      if (mountedRef.current) fail(error);
    }
  };

  const confirmDisable = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !disableChallenge) return;
    const normalizedRecovery = normalizeRecoveryCode(recoveryCode);
    if (disableCode && normalizedRecovery) return fail("Use código ou recovery code, nunca ambos.");
    if (!disableCode && !normalizedRecovery) return fail("Informe o código ou um recovery code.");
    if (disableCode && !/^\d{6}$/.test(disableCode))
      return fail("Informe o código de seis dígitos.");
    if (normalizedRecovery && !/^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(normalizedRecovery))
      return fail("Informe um recovery code válido.");
    setMessage("");
    try {
      await actions.confirmDisable(
        disableCode
          ? { challengeId: disableChallenge.challengeId, code: disableCode }
          : { challengeId: disableChallenge.challengeId, recoveryCode: normalizedRecovery },
      );
    } catch (error) {
      if (mountedRef.current) fail(error);
    }
  };

  const closeRecoveryCodes = async () => {
    setRecoveryCodes([]);
    await status.refetch();
  };

  const data = status.data;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" /> Autenticação em duas etapas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p
          ref={errorRef}
          tabIndex={-1}
          aria-live="polite"
          className={
            tone === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"
          }
        >
          {message}
        </p>
        {status.isLoading && (
          <p className="text-sm text-muted-foreground">Carregando status real do 2FA...</p>
        )}
        {status.error && (
          <p className="text-sm text-destructive">{friendlyAuthError(status.error).message}</p>
        )}
        {data && (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Status:{" "}
              <strong className="text-foreground">{data.enabled ? "ativado" : "desativado"}</strong>
            </p>
            <p>
              Método:{" "}
              {data.method === "EMAIL" ? "E-mail" : data.method === "SMS" ? "SMS" : "Nenhum"}
            </p>
            <p>Ativado em: {formatDate(data.enabledAt)}</p>
            <p>Recovery codes restantes: {data.recoveryCodesRemaining}</p>
            {data.enabled && data.recoveryCodesRemaining <= 2 && (
              <p
                role="status"
                className="rounded border border-amber-300 bg-amber-50 p-2 text-amber-900"
              >
                Poucos recovery codes restantes. A regeneração será integrada em sprint futura.
              </p>
            )}
          </div>
        )}
        {recoveryCodes.length > 0 && (
          <RecoveryCodesDisplay codes={recoveryCodes} onClose={() => void closeRecoveryCodes()} />
        )}
        {data && !data.enabled && recoveryCodes.length === 0 && !enrollChallenge && (
          <form onSubmit={requestEnrollment} className="space-y-3">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-foreground">Método do 2FA</legend>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="two-factor-method"
                  value="EMAIL"
                  checked={method === "EMAIL"}
                  disabled={!emailVerified || busy}
                  onChange={() => setMethod("EMAIL")}
                />
                E-mail {emailVerified ? "" : "(confirme seu e-mail primeiro)"}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="two-factor-method"
                  value="SMS"
                  checked={method === "SMS"}
                  disabled={!phoneVerified || busy}
                  onChange={() => setMethod("SMS")}
                />
                SMS {phoneVerified ? "" : "(confirme seu telefone primeiro)"}
              </label>
            </fieldset>
            <div>
              <Label htmlFor="two-factor-enroll-password">Senha atual</Label>
              <Input
                id="two-factor-enroll-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              disabled={busy || (method === "EMAIL" ? !emailVerified : !phoneVerified)}
            >
              {actions.enrollRequestPending ? "Enviando código..." : "Ativar 2FA"}
            </Button>
          </form>
        )}
        {enrollChallenge && (
          <form onSubmit={confirmEnrollment} className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Challenge recebido. Expira em {formatDate(enrollChallenge.expiresAt)}.
            </p>
            <div>
              <Label htmlFor="two-factor-enroll-code">Código de ativação</Label>
              <Input
                id="two-factor-enroll-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>
                {actions.enrollConfirmPending ? "Confirmando..." : "Confirmar ativação"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void resendEnrollment()}
              >
                Enviar novo código
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setEnrollChallenge(null);
                  setCode("");
                }}
              >
                Voltar
              </Button>
            </div>
          </form>
        )}
        {data?.enabled && !disableChallenge && (
          <form onSubmit={requestDisable} className="space-y-3">
            <p className="rounded border border-destructive/30 bg-destructive/5 p-2 text-sm text-muted-foreground">
              Desativar 2FA reduz a segurança da conta e encerrará todas as sessões.
            </p>
            <div>
              <Label htmlFor="two-factor-disable-password">Senha atual</Label>
              <Input
                id="two-factor-disable-password"
                type="password"
                autoComplete="current-password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={disableConfirmed}
                onChange={(e) => setDisableConfirmed(e.target.checked)}
              />
              Entendo que desativar o 2FA reduz a segurança
            </label>
            <Button type="submit" variant="destructive" disabled={busy}>
              {actions.disableRequestPending ? "Enviando código..." : "Solicitar desativação"}
            </Button>
          </form>
        )}
        {disableChallenge && (
          <form onSubmit={confirmDisable} className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Challenge recebido. Expira em {formatDate(disableChallenge.expiresAt)}.
            </p>
            <div>
              <Label htmlFor="two-factor-disable-code">Código de seis dígitos</Label>
              <Input
                id="two-factor-disable-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </div>
            <div>
              <Label htmlFor="two-factor-disable-recovery">Ou recovery code</Label>
              <Input
                id="two-factor-disable-recovery"
                autoComplete="off"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(normalizeRecoveryCode(e.target.value))}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="destructive" disabled={busy}>
                {actions.disableConfirmPending ? "Desativando..." : "Confirmar desativação"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void resendDisable()}
              >
                Enviar novo código
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setDisableChallenge(null);
                  setDisableCode("");
                  setRecoveryCode("");
                }}
              >
                Voltar
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
