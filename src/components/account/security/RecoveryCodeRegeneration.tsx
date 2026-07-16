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
  type StepUpVerifyPayload,
} from "@/services/auth";
import { RecoveryCodesDisplay } from "./RecoveryCodesDisplay";

type Props = { disabled: boolean; onExclusiveChange?: (exclusive: boolean) => void };
type BlockReason = "malformed" | "closing" | null;

const malformedRecoveryMessage =
  "Os recovery codes podem ter sido regenerados, mas não foi possível exibi-los. Inicie uma nova regeneração para criar outro conjunto seguro.";

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "não informado" : date.toLocaleString("pt-BR");
}
function delivery(method: "EMAIL" | "SMS") {
  return method === "SMS" ? "Código enviado por SMS." : "Código enviado por e-mail.";
}
function isRecoverableVerifyError(error: unknown) {
  return (
    error instanceof ApiError &&
    [
      "INVALID_2FA_INPUT",
      "INVALID_RECOVERY_CODE",
      "RATE_LIMITED",
      "INVALID_OR_EXPIRED_STEP_UP_CODE",
    ].includes(error.code)
  );
}
function isTerminalVerifyError(error: unknown) {
  return (
    error instanceof ApiError &&
    [
      "STEP_UP_CHALLENGE_LOCKED",
      "INVALID_OR_EXPIRED_STEP_UP_GRANT",
      "STEP_UP_SCOPE_MISMATCH",
      "STEP_UP_REQUIRED",
    ].includes(error.code)
  );
}

export function RecoveryCodeRegeneration({ disabled, onExclusiveChange }: Props) {
  const actions = useStepUpSecurity();
  const [accepted, setAccepted] = useState(false);
  const [started, setStarted] = useState(false);
  const [password, setPassword] = useState("");
  const [challenge, setChallenge] = useState<StepUpChallenge | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newRecoveryCodes, setNewRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [blockReason, setBlockReason] = useState<BlockReason>(null);
  const [closingReconciliation, setClosingReconciliation] = useState(false);
  const mountedRef = useRef(false);
  const showingCodes = newRecoveryCodes.length > 0;
  const regenerationActive =
    started ||
    challenge !== null ||
    showingCodes ||
    blockReason !== null ||
    closingReconciliation ||
    actions.requestPending ||
    actions.verifyPending ||
    actions.resendPending ||
    actions.reconcilePending;
  const busy =
    disabled ||
    actions.requestPending ||
    actions.verifyPending ||
    actions.resendPending ||
    actions.reconcilePending ||
    closingReconciliation;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      onExclusiveChange?.(false);
    };
  }, [onExclusiveChange]);
  useEffect(() => onExclusiveChange?.(regenerationActive), [onExclusiveChange, regenerationActive]);

  const fail = (message: string) => {
    setError(message);
    setInfo("");
  };
  const clearTransientInputs = () => {
    setPassword("");
    setChallenge(null);
    setCode("");
    setRecoveryCode("");
  };
  const resetFlow = () => {
    setAccepted(false);
    setStarted(false);
    setNewRecoveryCodes([]);
    setBlockReason(null);
    setClosingReconciliation(false);
    clearTransientInputs();
  };
  const reconcileAndRelease = async (releaseOnSuccess: () => void) => {
    try {
      await actions.reconcileStepUpRelatedData();
      if (!mountedRef.current) return;
      releaseOnSuccess();
    } catch (error) {
      if (mountedRef.current) fail(friendlyAuthError(error).message);
    }
  };
  const reconcileAfterMalformed = async () => {
    setBlockReason("malformed");
    await reconcileAndRelease(() => {
      resetFlow();
      setError(malformedRecoveryMessage);
    });
  };
  const request = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !started) return;
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
      clearTransientInputs();
      setStarted(true);
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
    let payload: StepUpVerifyPayload;
    try {
      payload = buildStepUpVerifyPayload(challenge.challengeId, code, recoveryCode);
    } catch (error) {
      fail(friendlyAuthError(error).message);
      return;
    }
    try {
      const response = await actions.verifyStepUpAndRegenerateRecoveryCodes(payload);
      if (!mountedRef.current) return;
      setNewRecoveryCodes(response.recoveryCodes);
      clearTransientInputs();
      setAccepted(false);
      setStarted(false);
      void actions.refreshStepUpRelatedData();
    } catch (error) {
      if (!mountedRef.current) return;
      if (error instanceof ApiError && error.code === "MALFORMED_RESPONSE") {
        clearTransientInputs();
        fail(malformedRecoveryMessage);
        void reconcileAfterMalformed();
        return;
      }
      if (isRecoverableVerifyError(error)) {
        fail(
          error instanceof ApiError && error.code === "INVALID_OR_EXPIRED_STEP_UP_CODE"
            ? "Código inválido ou expirado. Corrija os dados ou solicite reenvio."
            : friendlyAuthError(error).message,
        );
        return;
      }
      if (isTerminalVerifyError(error)) {
        clearTransientInputs();
        setStarted(true);
        fail(friendlyAuthError(error).message);
        return;
      }
      clearTransientInputs();
      setStarted(true);
      fail(friendlyAuthError(error).message);
    }
  };
  const closeCodes = async () => {
    if (closingReconciliation) return;
    setClosingReconciliation(true);
    setBlockReason("closing");
    setNewRecoveryCodes([]);
    setAccepted(false);
    setStarted(false);
    setError("");
    setInfo("");
    clearTransientInputs();
    await reconcileAndRelease(() => resetFlow());
    if (mountedRef.current) setClosingReconciliation(false);
  };
  const retryReconcile = async () => {
    setClosingReconciliation(true);
    await reconcileAndRelease(() => resetFlow());
    if (mountedRef.current) setClosingReconciliation(false);
  };
  const start = () => {
    if (!accepted || disabled) return;
    setStarted(true);
    setError("");
    setInfo("");
  };
  const cancel = () => {
    if (busy) return;
    resetFlow();
    setError("");
    setInfo("");
  };

  if (showingCodes) {
    return (
      <RecoveryCodesDisplay
        title="Novos recovery codes"
        recoveryCodes={newRecoveryCodes}
        closing={closingReconciliation || actions.reconcilePending}
        onClose={() => void closeCodes()}
      />
    );
  }

  if (blockReason) {
    return (
      <div className="space-y-3 rounded-2xl border p-4">
        <p role="alert" className="text-sm text-destructive">
          {error || "Não foi possível reconciliar o status da segurança. Tente novamente."}
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={closingReconciliation || actions.reconcilePending}
          onClick={() => void retryReconcile()}
        >
          {closingReconciliation || actions.reconcilePending
            ? "Verificando..."
            : "Tentar reconciliar novamente"}
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
      {!started && !challenge && (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={accepted}
              disabled={disabled}
              onChange={(e) => setAccepted(e.target.checked)}
            />{" "}
            Confirmo que desejo regenerar meus recovery codes
          </label>
          <Button type="button" disabled={disabled || !accepted} onClick={start}>
            Regenerar recovery codes
          </Button>
        </>
      )}
      {started && !challenge && (
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
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>
              {actions.requestPending ? "Solicitando..." : "Solicitar código"}
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={cancel}>
              Cancelar
            </Button>
          </div>
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
            <Button type="button" variant="outline" disabled={busy} onClick={cancel}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
