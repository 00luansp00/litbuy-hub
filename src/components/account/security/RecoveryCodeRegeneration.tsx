import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildStepUpVerifyPayload,
  friendlyAuthError,
  normalizeRecoveryCode,
  recoveryCodePattern,
  useStepUpSecurity,
  type StepUpChallenge,
} from "@/services/auth";
import { RecoveryCodesDisplay } from "./RecoveryCodesDisplay";

type Props = { disabled: boolean; onExclusiveChange?: (exclusive: boolean) => void };
function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "não informado" : date.toLocaleString("pt-BR");
}
function delivery(method: "EMAIL" | "SMS") {
  return method === "SMS" ? "Código enviado por SMS." : "Código enviado por e-mail.";
}

export function RecoveryCodeRegeneration({ disabled, onExclusiveChange }: Props) {
  const actions = useStepUpSecurity();
  const [confirmed, setConfirmed] = useState(false);
  const [password, setPassword] = useState("");
  const [challenge, setChallenge] = useState<StepUpChallenge | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newRecoveryCodes, setNewRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [blockedAfterMalformed, setBlockedAfterMalformed] = useState(false);
  const mountedRef = useRef(false);
  const showingCodes = newRecoveryCodes.length > 0;
  const busy =
    disabled ||
    actions.requestPending ||
    actions.verifyPending ||
    actions.resendPending ||
    actions.reconcilePending;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  useEffect(() => onExclusiveChange?.(showingCodes), [onExclusiveChange, showingCodes]);

  const fail = (message: string) => {
    setError(message);
    setInfo("");
  };
  const resetChallenge = () => {
    setChallenge(null);
    setCode("");
    setRecoveryCode("");
  };
  const reconcileAfterMalformed = async () => {
    setBlockedAfterMalformed(true);
    try {
      await actions.reconcileStepUpRelatedData();
    } catch {
      // Keep blocked until the user retries reconciliation.
    }
  };
  const request = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !confirmed) return;
    if (!password) return fail("Informe a senha atual.");
    setError("");
    setInfo("");
    try {
      const response = await actions.requestStepUp(password);
      if (!mountedRef.current) return;
      setChallenge(response);
      setPassword("");
      setCode("");
      setRecoveryCode("");
      setInfo(delivery(response.method));
    } catch (error) {
      if (mountedRef.current) fail(friendlyAuthError(error).message);
    }
  };
  const resend = async () => {
    if (busy || !challenge) return;
    setError("");
    setInfo("");
    try {
      const response = await actions.resendStepUp(challenge.challengeId);
      if (!mountedRef.current) return;
      setChallenge(response);
      setCode("");
      setRecoveryCode("");
      setInfo(delivery(response.method));
    } catch (error) {
      if (!mountedRef.current) return;
      if (error instanceof ApiError && error.code === "RATE_LIMITED") {
        fail("Aguarde antes de reenviar o código.");
        return;
      }
      resetChallenge();
      fail(
        error instanceof ApiError && error.code === "STEP_UP_DELIVERY_UNAVAILABLE"
          ? "Entrega indisponível. Inicie novamente com a senha atual."
          : friendlyAuthError(error).message,
      );
    }
  };
  const verify = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !challenge) return;
    setError("");
    setInfo("");
    try {
      const payload = buildStepUpVerifyPayload(challenge.challengeId, code, recoveryCode);
      const response = await actions.verifyStepUpAndRegenerateRecoveryCodes(payload);
      if (!mountedRef.current) return;
      setNewRecoveryCodes(response.recoveryCodes);
      resetChallenge();
      setConfirmed(false);
      void actions.refreshStepUpRelatedData();
    } catch (error) {
      if (!mountedRef.current) return;
      resetChallenge();
      if (error instanceof ApiError && error.code === "MALFORMED_RESPONSE") {
        fail(
          "Os recovery codes podem ter sido regenerados, mas não foi possível exibi-los. Inicie uma nova regeneração para criar outro conjunto seguro.",
        );
        void reconcileAfterMalformed();
        return;
      }
      fail(friendlyAuthError(error).message);
    }
  };
  const closeCodes = async () => {
    setNewRecoveryCodes([]);
    try {
      await actions.reconcileStepUpRelatedData();
    } catch (error) {
      if (mountedRef.current) fail(friendlyAuthError(error).message);
    }
  };
  const retryReconcile = async () => {
    try {
      await actions.reconcileStepUpRelatedData();
      if (mountedRef.current) setBlockedAfterMalformed(false);
    } catch (error) {
      if (mountedRef.current) fail(friendlyAuthError(error).message);
    }
  };

  if (showingCodes) {
    return (
      <RecoveryCodesDisplay
        title="Novos recovery codes"
        recoveryCodes={newRecoveryCodes}
        closing={actions.reconcilePending}
        onClose={() => void closeCodes()}
      />
    );
  }

  if (blockedAfterMalformed) {
    return (
      <div className="space-y-3 rounded-2xl border p-4">
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={actions.reconcilePending}
          onClick={() => void retryReconcile()}
        >
          {actions.reconcilePending ? "Verificando..." : "Tentar reconciliar novamente"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border p-4">
      <p className="text-sm font-medium">Regenerar recovery codes</p>
      <p className="text-sm text-muted-foreground">
        Todos os recovery codes antigos serão invalidados, outras sessões serão encerradas, a sessão
        atual será preservada e os novos códigos serão exibidos apenas uma vez.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {info && <p className="text-sm text-muted-foreground">{info}</p>}
      {!confirmed && !challenge && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            disabled={busy}
            onChange={(e) => setConfirmed(e.target.checked)}
          />{" "}
          Confirmo que desejo regenerar meus recovery codes
        </label>
      )}
      {confirmed && !challenge && (
        <form onSubmit={request} className="space-y-3">
          <div>
            <Label htmlFor="step-up-current-password">Senha atual</Label>
            <Input
              id="step-up-current-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={busy}>
            {actions.requestPending ? "Solicitando..." : "Solicitar código"}
          </Button>
        </form>
      )}
      {challenge && (
        <form onSubmit={verify} className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {delivery(challenge.method)} Expira em {formatDate(challenge.expiresAt)}. Usar um
            recovery code aqui consome esse código.
          </p>
          <div>
            <Label htmlFor="step-up-code">Código de seis dígitos</Label>
            <Input
              id="step-up-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </div>
          <div>
            <Label htmlFor="step-up-recovery-code">Recovery code</Label>
            <Input
              id="step-up-recovery-code"
              value={recoveryCode}
              onChange={(e) => setRecoveryCode(normalizeRecoveryCode(e.target.value))}
              aria-invalid={recoveryCode.length > 0 && !recoveryCodePattern.test(recoveryCode)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>
              {actions.verifyPending ? "Regenerando..." : "Confirmar e regenerar"}
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => void resend()}>
              {actions.resendPending ? "Reenviando..." : "Reenviar código"}
            </Button>
          </div>
        </form>
      )}
      {!confirmed && !challenge && (
        <Button type="button" disabled={disabled} onClick={() => setConfirmed(true)}>
          Regenerar recovery codes
        </Button>
      )}
    </div>
  );
}
