import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildStepUpVerifyPayload,
  friendlyAuthError,
  normalizeRecoveryCode,
  useTwoFactorMethodChange,
  type TwoFactorMethod,
  type TwoFactorStatus,
} from "@/services/auth";

type Step =
  | "idle"
  | "password"
  | "step-up"
  | "select"
  | "confirm"
  | "reconcile-confirmed"
  | "reconcile-unknown";
type StepUpChallenge = { challengeId: string; method: TwoFactorMethod; expiresAt: string };
type ChangeChallenge = { challengeId: string; expiresAt: string; newMethod: TwoFactorMethod };

type Props = {
  status: TwoFactorStatus;
  smsAvailable: boolean;
  disabled: boolean;
  onExclusiveChange: (exclusive: boolean) => void;
  onReconcile: () => Promise<TwoFactorStatus>;
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "não informado" : date.toLocaleString("pt-BR");
}
function nextMethods(current: TwoFactorMethod, smsAvailable: boolean) {
  return (["EMAIL", "SMS"] as const).filter(
    (method) => method !== current && (method !== "SMS" || smsAvailable),
  );
}

export function TwoFactorMethodChange({
  status,
  smsAvailable,
  disabled,
  onExclusiveChange,
  onReconcile,
}: Props) {
  const actions = useTwoFactorMethodChange();
  const mountedRef = useRef(false);
  const cleanupRef = useRef({ clearGrant: actions.clearGrant, onExclusiveChange });
  const [step, setStep] = useState<Step>("idle");
  const [accepted, setAccepted] = useState(false);
  const [password, setPassword] = useState("");
  const [stepUpChallenge, setStepUpChallenge] = useState<StepUpChallenge | null>(null);
  const [stepUpCode, setStepUpCode] = useState("");
  const [stepUpRecovery, setStepUpRecovery] = useState("");
  const [newMethod, setNewMethod] = useState<TwoFactorMethod>("EMAIL");
  const [changeChallenge, setChangeChallenge] = useState<ChangeChallenge | null>(null);
  const [changeCode, setChangeCode] = useState("");
  const [criticalWarning, setCriticalWarning] = useState("");
  const [reconciliationError, setReconciliationError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [reconciling, setReconciling] = useState(false);
  const [reconcileExpectedMethod, setReconcileExpectedMethod] = useState<TwoFactorMethod | null>(
    null,
  );
  const methods = nextMethods(status.method ?? "EMAIL", smsAvailable);
  const busy =
    disabled ||
    actions.requestPending ||
    actions.verifyPending ||
    actions.resendPending ||
    actions.changePending ||
    actions.confirmPending ||
    reconciling;
  const exclusive = step !== "idle";

  useEffect(() => {
    cleanupRef.current = { clearGrant: actions.clearGrant, onExclusiveChange };
  }, [actions.clearGrant, onExclusiveChange]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanupRef.current.clearGrant();
      cleanupRef.current.onExclusiveChange(false);
    };
  }, []);
  useEffect(() => onExclusiveChange(exclusive), [exclusive, onExclusiveChange]);
  useEffect(() => {
    if (methods[0] && !methods.includes(newMethod)) setNewMethod(methods[0]);
  }, [methods, newMethod]);

  const clearMessages = () => {
    setCriticalWarning("");
    setReconciliationError("");
    setSuccessMessage("");
  };
  const fail = (error: unknown) => {
    setCriticalWarning(friendlyAuthError(error).message);
    setSuccessMessage("");
  };
  const resetFlow = () => {
    actions.clearGrant();
    setStep("idle");
    setAccepted(false);
    setPassword("");
    setStepUpChallenge(null);
    setStepUpCode("");
    setStepUpRecovery("");
    setChangeChallenge(null);
    setChangeCode("");
    setReconcileExpectedMethod(null);
  };
  const cancel = () => {
    resetFlow();
    clearMessages();
  };
  const reconcile = async (
    mode: "confirmed" | "unknown",
    expectedMethod: TwoFactorMethod | null,
  ) => {
    setReconciliationError("");
    setSuccessMessage("");
    setReconciling(true);
    try {
      const reconciledStatus = await onReconcile();
      if (!mountedRef.current) return false;
      if (mode === "confirmed") {
        const methodToConfirm = expectedMethod ?? reconcileExpectedMethod;
        if (!reconciledStatus.enabled || reconciledStatus.method !== methodToConfirm) {
          setReconciliationError(
            "O status ainda não confirmou a troca. Tente atualizar novamente.",
          );
          setStep("reconcile-confirmed");
          return false;
        }
        resetFlow();
        setSuccessMessage("Método de 2FA atualizado com segurança.");
        return true;
      }
      resetFlow();
      setSuccessMessage("Status da segurança atualizado. Confira o método de 2FA exibido.");
      return true;
    } catch (error) {
      if (mountedRef.current) setReconciliationError(friendlyAuthError(error).message);
      return false;
    } finally {
      if (mountedRef.current) setReconciling(false);
    }
  };

  const requestStepUp = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !accepted) return;
    if (!password) return setCriticalWarning("Informe a senha atual.");
    clearMessages();
    try {
      const challenge = await actions.requestStepUp(password);
      if (!mountedRef.current) return;
      setStepUpChallenge(challenge);
      setPassword("");
      setStep("step-up");
    } catch (error) {
      if (mountedRef.current) fail(error);
    }
  };
  const resendStepUp = async () => {
    if (busy || !stepUpChallenge) return;
    clearMessages();
    try {
      const challenge = await actions.resendStepUp(stepUpChallenge.challengeId);
      if (!mountedRef.current) return;
      setStepUpChallenge(challenge);
      setStepUpCode("");
      setStepUpRecovery("");
    } catch (error) {
      if (!mountedRef.current) return;
      fail(error);
      if (
        error instanceof ApiError &&
        [
          "STEP_UP_DELIVERY_UNAVAILABLE",
          "INVALID_OR_EXPIRED_STEP_UP_CODE",
          "STEP_UP_CHALLENGE_LOCKED",
          "INVALID_SESSION",
          "FORBIDDEN",
        ].includes(error.code)
      ) {
        setStepUpChallenge(null);
        setStepUpCode("");
        setStepUpRecovery("");
        setStep("password");
      }
    }
  };
  const verifyStepUp = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !stepUpChallenge) return;
    clearMessages();
    try {
      const payload = buildStepUpVerifyPayload(
        stepUpChallenge.challengeId,
        stepUpCode,
        stepUpRecovery,
      );
      await actions.verifyStepUp(payload);
      if (!mountedRef.current) return;
      setStep("select");
      setStepUpChallenge(null);
      setStepUpCode("");
      setStepUpRecovery("");
    } catch (error) {
      if (!mountedRef.current) return;
      fail(error);
      if (
        error instanceof ApiError &&
        [
          "STEP_UP_CHALLENGE_LOCKED",
          "INVALID_OR_EXPIRED_STEP_UP_GRANT",
          "STEP_UP_SCOPE_MISMATCH",
        ].includes(error.code)
      ) {
        actions.clearGrant();
        setStep("password");
        setStepUpChallenge(null);
      }
    }
  };
  const requestChange = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || methods.length === 0) return;
    if (newMethod === status.method)
      return setCriticalWarning("Escolha um método diferente do atual.");
    clearMessages();
    try {
      const challenge = await actions.requestMethodChange({ newMethod });
      if (!mountedRef.current) return;
      setChangeChallenge({ ...challenge, newMethod });
      setChangeCode("");
      setStep("confirm");
    } catch (error) {
      if (!mountedRef.current) return;
      fail(error);
      if (
        error instanceof ApiError &&
        [
          "STEP_UP_REQUIRED",
          "INVALID_OR_EXPIRED_STEP_UP_GRANT",
          "STEP_UP_SCOPE_MISMATCH",
          "INVALID_SESSION",
          "FORBIDDEN",
          "TWO_FACTOR_METHOD_CHANGE_CONFLICT",
        ].includes(error.code)
      ) {
        actions.clearGrant();
        setStep("password");
      }
    }
  };
  const confirmChange = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !changeChallenge) return;
    if (!/^\d{6}$/.test(changeCode)) return setCriticalWarning("Informe o código de seis dígitos.");
    clearMessages();
    try {
      const confirmedMethod = changeChallenge.newMethod;
      await actions.confirmMethodChange({
        challengeId: changeChallenge.challengeId,
        code: changeCode,
      });
      if (!mountedRef.current) return;
      setChangeChallenge(null);
      setChangeCode("");
      setReconcileExpectedMethod(confirmedMethod);
      setStep("reconcile-confirmed");
      await reconcile("confirmed", confirmedMethod);
    } catch (error) {
      if (!mountedRef.current) return;
      if (error instanceof ApiError && error.code === "TWO_FACTOR_METHOD_CHANGE_OUTCOME_UNKNOWN") {
        actions.clearGrant();
        setChangeChallenge(null);
        setChangeCode("");
        setStep("reconcile-unknown");
        setCriticalWarning(
          "A troca pode ter sido aplicada. Vamos consultar o status real antes de liberar ações.",
        );
        const reconciled = await reconcile("unknown", null);
        if (!reconciled && mountedRef.current) setStep("reconcile-unknown");
        return;
      }
      fail(error);
      if (
        error instanceof ApiError &&
        [
          "STEP_UP_REQUIRED",
          "INVALID_OR_EXPIRED_STEP_UP_GRANT",
          "STEP_UP_SCOPE_MISMATCH",
          "INVALID_SESSION",
          "FORBIDDEN",
          "TWO_FACTOR_METHOD_CHANGE_CONFLICT",
        ].includes(error.code)
      ) {
        actions.clearGrant();
        setStep("password");
        setChangeChallenge(null);
      }
    }
  };

  if (!status.enabled || !status.method) return null;
  if (methods.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum método alternativo disponível.</p>;
  }

  return (
    <section className="space-y-3 rounded-2xl border p-4">
      <div className="space-y-1">
        <h3 className="font-semibold">Trocar método de 2FA</h3>
        <p className="text-sm text-muted-foreground">
          Confirme sua identidade, escolha o novo método disponível e valide o código enviado.
        </p>
      </div>
      {criticalWarning && (
        <p role="alert" className="text-sm text-amber-600">
          {criticalWarning}
        </p>
      )}
      {reconciliationError && (
        <p role="alert" className="text-sm text-destructive">
          {reconciliationError}
        </p>
      )}
      {successMessage && (
        <p role="status" className="text-sm text-muted-foreground">
          {successMessage}
        </p>
      )}
      {reconciling && (
        <p className="text-sm text-muted-foreground">Atualizando status e sessões reais...</p>
      )}
      {step === "idle" && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            Confirmo que autorizo a troca segura do método de 2FA.
          </label>
          <Button type="button" disabled={busy || !accepted} onClick={() => setStep("password")}>
            Alterar método de 2FA
          </Button>
        </div>
      )}
      {step === "password" && (
        <form onSubmit={requestStepUp} className="space-y-3">
          <div>
            <Label htmlFor="method-change-password">Senha atual</Label>
            <Input
              id="method-change-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={busy}>
            {actions.requestPending ? "Solicitando..." : "Solicitar step-up"}
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={cancel}>
            Cancelar
          </Button>
        </form>
      )}
      {step === "step-up" && stepUpChallenge && (
        <form onSubmit={verifyStepUp} className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Código enviado por {stepUpChallenge.method === "EMAIL" ? "e-mail" : "SMS"}. Expira em{" "}
            {formatDate(stepUpChallenge.expiresAt)}.
          </p>
          <div>
            <Label htmlFor="method-change-step-up-code">Código de seis dígitos</Label>
            <Input
              id="method-change-step-up-code"
              inputMode="numeric"
              maxLength={6}
              value={stepUpCode}
              onChange={(e) => setStepUpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </div>
          <div>
            <Label htmlFor="method-change-step-up-recovery">Recovery code</Label>
            <Input
              id="method-change-step-up-recovery"
              value={stepUpRecovery}
              onChange={(e) => setStepUpRecovery(normalizeRecoveryCode(e.target.value))}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Use um código de seis dígitos ou um recovery code completo.
          </p>
          <Button type="submit" disabled={busy}>
            {actions.verifyPending ? "Confirmando..." : "Confirmar step-up"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void resendStepUp()}
          >
            {actions.resendPending ? "Reenviando..." : "Reenviar step-up"}
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={cancel}>
            Cancelar
          </Button>
        </form>
      )}
      {step === "select" && (
        <form onSubmit={requestChange} className="space-y-3">
          <div>
            <Label htmlFor="method-change-new-method">Novo método</Label>
            <select
              id="method-change-new-method"
              className="w-full rounded-md border bg-background p-2"
              value={newMethod}
              onChange={(e) => setNewMethod(e.target.value as TwoFactorMethod)}
            >
              {methods.map((method) => (
                <option key={method} value={method}>
                  {method === "EMAIL" ? "por e-mail" : "por SMS"}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={busy}>
            {actions.changePending ? "Enviando..." : "Enviar código ao novo método"}
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={cancel}>
            Cancelar
          </Button>
        </form>
      )}
      {step === "confirm" && changeChallenge && (
        <form onSubmit={confirmChange} className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Código enviado {changeChallenge.newMethod === "EMAIL" ? "por e-mail" : "por SMS"}.
            Expira em {formatDate(changeChallenge.expiresAt)}.
          </p>
          <div>
            <Label htmlFor="method-change-code">Código de seis dígitos</Label>
            <Input
              id="method-change-code"
              inputMode="numeric"
              maxLength={6}
              value={changeCode}
              onChange={(e) => setChangeCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </div>
          <Button type="submit" disabled={busy}>
            {actions.confirmPending ? "Confirmando..." : "Confirmar troca"}
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={cancel}>
            Cancelar
          </Button>
        </form>
      )}
      {step === "reconcile-confirmed" && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            A troca foi confirmada pelo servidor. As ações permanecem bloqueadas até atualizarmos o
            status e as sessões reais.
          </p>
          <Button type="button" disabled={busy} onClick={() => void reconcile("confirmed", null)}>
            Tentar reconciliar novamente
          </Button>
        </div>
      )}
      {step === "reconcile-unknown" && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Resultado desconhecido. As ações permanecem bloqueadas até a reconciliação real de
            status e sessões.
          </p>
          <Button type="button" disabled={busy} onClick={() => void reconcile("unknown", null)}>
            Tentar reconciliar novamente
          </Button>
        </div>
      )}
    </section>
  );
}
