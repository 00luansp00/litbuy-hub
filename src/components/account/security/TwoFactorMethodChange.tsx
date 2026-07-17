import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  friendlyAuthError,
  normalizeRecoveryCode,
  recoveryCodePattern,
  useTwoFactorMethodChange,
  type TwoFactorMethod,
  type TwoFactorStepUpChallenge,
} from "@/services/auth";

type Step = "idle" | "password" | "step-up" | "method" | "confirm" | "reconcile";
type MethodChallenge = { challengeId: string; expiresAt: string; newMethod: TwoFactorMethod };

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Não informado" : date.toLocaleString("pt-BR");
}

function nextMethods(currentMethod: TwoFactorMethod, smsAvailable: boolean) {
  return (["EMAIL", "SMS"] as const).filter(
    (method) => method !== currentMethod && (method !== "SMS" || smsAvailable),
  );
}

export function TwoFactorMethodChange({
  currentMethod,
  smsAvailable,
  disabled,
  onExclusiveChange,
}: {
  currentMethod: TwoFactorMethod;
  smsAvailable: boolean;
  disabled: boolean;
  onExclusiveChange: (exclusive: boolean) => void;
}) {
  const actions = useTwoFactorMethodChange();
  const mountedRef = useRef(false);
  const [accepted, setAccepted] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [password, setPassword] = useState("");
  const [stepUpChallenge, setStepUpChallenge] = useState<TwoFactorStepUpChallenge | null>(null);
  const [stepUpCode, setStepUpCode] = useState("");
  const [stepUpRecovery, setStepUpRecovery] = useState("");
  const [newMethod, setNewMethod] = useState<TwoFactorMethod | "">("");
  const [methodChallenge, setMethodChallenge] = useState<MethodChallenge | null>(null);
  const [methodCode, setMethodCode] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [criticalWarning, setCriticalWarning] = useState("");
  const [reconciliationError, setReconciliationError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const options = nextMethods(currentMethod, smsAvailable);
  const reconciling = step === "reconcile";
  const busy =
    disabled ||
    reconciling ||
    actions.stepUpPending ||
    actions.verifyPending ||
    actions.resendPending ||
    actions.changeRequestPending ||
    actions.changeConfirmPending;
  const exclusive = step !== "idle" || reconciling;

  const clearGrantRef = useRef(actions.clearGrant);

  useEffect(() => {
    clearGrantRef.current = actions.clearGrant;
  }, [actions.clearGrant]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearGrantRef.current();
      onExclusiveChange(false);
    };
  }, [onExclusiveChange]);

  useEffect(() => {
    onExclusiveChange(exclusive);
  }, [exclusive, onExclusiveChange]);

  const resetFlow = () => {
    actions.clearGrant();
    setStep("idle");
    setPassword("");
    setStepUpChallenge(null);
    setStepUpCode("");
    setStepUpRecovery("");
    setNewMethod("");
    setMethodChallenge(null);
    setMethodCode("");
    setErrorMessage("");
    setCriticalWarning("");
    setReconciliationError("");
    setSuccessMessage("");
    onExclusiveChange(false);
  };

  const fail = (message: string) => {
    setErrorMessage(message);
  };

  const start = () => {
    if (disabled) return;
    setErrorMessage("");
    setSuccessMessage("");
    setCriticalWarning("");
    setReconciliationError("");
    if (!accepted) return fail("Confirme que entende o impacto da troca do método de 2FA.");
    onExclusiveChange(true);
    setStep("password");
  };

  const requestStepUp = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || step !== "password") return;
    if (!password) return fail("Informe a senha atual.");
    setErrorMessage("");
    try {
      const challenge = await actions.requestStepUp({ currentPassword: password });
      if (!mountedRef.current) return;
      setStepUpChallenge(challenge);
      setPassword("");
      setStep("step-up");
    } catch (error) {
      if (mountedRef.current) fail(friendlyAuthError(error).message);
    }
  };

  const verifyStepUp = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || step !== "step-up" || !stepUpChallenge) return;
    const hasCodeInput = stepUpCode.length > 0;
    const hasRecoveryInput = stepUpRecovery.trim().length > 0;
    if (hasCodeInput && hasRecoveryInput)
      return fail("Use apenas o código ou o recovery code, nunca ambos.");
    if (!hasCodeInput && !hasRecoveryInput) return fail("Informe o código ou um recovery code.");
    if (hasCodeInput && !/^\d{6}$/.test(stepUpCode))
      return fail("Informe o código de seis dígitos.");
    const normalizedRecovery = normalizeRecoveryCode(stepUpRecovery);
    if (hasRecoveryInput && !recoveryCodePattern.test(normalizedRecovery))
      return fail("Use um recovery code no formato XXXXX-XXXXX-XXXXX.");
    setErrorMessage("");
    try {
      if (hasCodeInput)
        await actions.verifyStepUp({ challengeId: stepUpChallenge.challengeId, code: stepUpCode });
      else
        await actions.verifyStepUp({
          challengeId: stepUpChallenge.challengeId,
          recoveryCode: normalizedRecovery,
        });
      if (!mountedRef.current) return;
      setStepUpCode("");
      setStepUpRecovery("");
      setStep("method");
    } catch (error) {
      if (mountedRef.current) fail(friendlyAuthError(error).message);
    }
  };

  const resendStepUp = async () => {
    if (busy || step !== "step-up" || !stepUpChallenge) return;
    setErrorMessage("");
    try {
      const challenge = await actions.resendStepUp({ challengeId: stepUpChallenge.challengeId });
      if (!mountedRef.current) return;
      setStepUpChallenge(challenge);
      setStepUpCode("");
      setStepUpRecovery("");
    } catch (error) {
      if (!mountedRef.current) return;
      if (error instanceof ApiError && error.code === "RATE_LIMITED") {
        fail(friendlyAuthError(error).message);
        return;
      }
      if (
        error instanceof ApiError &&
        (error.code === "STEP_UP_DELIVERY_UNAVAILABLE" ||
          error.code === "INVALID_OR_EXPIRED_STEP_UP_CODE" ||
          error.code === "STEP_UP_CHALLENGE_LOCKED")
      ) {
        setStepUpChallenge(null);
        setStepUpCode("");
        setStepUpRecovery("");
        setStep("password");
      }
      fail(friendlyAuthError(error).message);
    }
  };

  const requestMethodChange = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || step !== "method") return;
    if (!newMethod) return fail("Escolha o novo método de verificação.");
    setErrorMessage("");
    try {
      const challenge = await actions.requestMethodChange({ newMethod });
      if (!mountedRef.current) return;
      setMethodChallenge({ ...challenge, newMethod });
      setMethodCode("");
      setStep("confirm");
    } catch (error) {
      if (mountedRef.current) fail(friendlyAuthError(error).message);
    }
  };

  const reconcile = async () => {
    setStep("reconcile");
    setReconciliationError("");
    await actions.refreshMethodChangeRelatedData();
    if (!mountedRef.current) return;
    setCriticalWarning("");
    setReconciliationError("");
    setSuccessMessage("Status da segurança atualizado.");
    setAccepted(false);
    setStep("idle");
    onExclusiveChange(false);
  };

  const retryReconcile = async () => {
    try {
      await reconcile();
    } catch {
      if (mountedRef.current)
        setReconciliationError("Não foi possível atualizar o status da segurança.");
    }
  };

  const confirmMethodChange = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || step !== "confirm" || !methodChallenge) return;
    if (!/^\d{6}$/.test(methodCode)) return fail("Informe o código de seis dígitos.");
    setErrorMessage("");
    setSuccessMessage("");
    setReconciliationError("");
    try {
      await actions.confirmMethodChange({
        challengeId: methodChallenge.challengeId,
        code: methodCode,
      });
      if (!mountedRef.current) return;
      setMethodChallenge(null);
      setMethodCode("");
      try {
        await reconcile();
      } catch {
        if (mountedRef.current)
          setReconciliationError("Não foi possível atualizar o status da segurança.");
      }
    } catch (error) {
      if (!mountedRef.current) return;
      if (error instanceof ApiError && error.code === "TWO_FACTOR_METHOD_CHANGE_OUTCOME_UNKNOWN") {
        actions.clearGrant();
        setMethodChallenge(null);
        setMethodCode("");
        setCriticalWarning(
          "A troca pode ter sido aplicada, mas não foi possível confirmar o resultado.",
        );
        try {
          await reconcile();
        } catch {
          if (mountedRef.current)
            setReconciliationError("Não foi possível atualizar o status da segurança.");
        }
        return;
      }
      fail(friendlyAuthError(error).message);
    }
  };

  if (options.length === 0) {
    return (
      <div className="rounded-2xl border p-4 text-sm text-muted-foreground">
        Confirme um telefone para disponibilizar outro método de 2FA.
      </div>
    );
  }

  return (
    <section className="space-y-3 rounded-2xl border p-4">
      <div className="space-y-2">
        <p className="font-medium">Trocar método de 2FA</p>
        <p className="text-sm text-muted-foreground">
          Confirme sua identidade antes de trocar o método de verificação.
        </p>
        {step === "idle" && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={accepted}
              disabled={disabled}
              onChange={(event) => setAccepted(event.target.checked)}
            />
            Entendo que outras sessões podem ser revogadas.
          </label>
        )}
        <div className="flex flex-wrap gap-2">
          {step === "idle" && (
            <Button type="button" disabled={disabled} onClick={start}>
              Alterar método de 2FA
            </Button>
          )}
          {step !== "idle" && (
            <Button type="button" variant="outline" disabled={reconciling} onClick={resetFlow}>
              Cancelar
            </Button>
          )}
        </div>
      </div>

      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
      {criticalWarning && <p className="text-sm font-medium text-destructive">{criticalWarning}</p>}
      {reconciliationError && <p className="text-sm text-destructive">{reconciliationError}</p>}
      {successMessage && <p className="text-sm text-muted-foreground">{successMessage}</p>}

      {step === "password" && (
        <form onSubmit={requestStepUp} className="space-y-3">
          <div>
            <Label htmlFor="method-change-password">Senha da conta</Label>
            <Input
              id="method-change-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={busy}>
            {actions.stepUpPending ? "Solicitando..." : "Solicitar step-up"}
          </Button>
        </form>
      )}

      {step === "step-up" && stepUpChallenge && (
        <form onSubmit={verifyStepUp} className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Código enviado ao método atual. Expira em {formatDate(stepUpChallenge.expiresAt)}.
          </p>
          <div>
            <Label htmlFor="method-change-step-up-code">Código</Label>
            <Input
              id="method-change-step-up-code"
              inputMode="numeric"
              maxLength={6}
              value={stepUpCode}
              onChange={(event) => setStepUpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </div>
          <div>
            <Label htmlFor="method-change-step-up-recovery">Recovery code</Label>
            <Input
              id="method-change-step-up-recovery"
              value={stepUpRecovery}
              onChange={(event) => setStepUpRecovery(normalizeRecoveryCode(event.target.value))}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>
              {actions.verifyPending ? "Verificando..." : "Confirmar identidade"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void resendStepUp()}
            >
              {actions.resendPending ? "Reenviando..." : "Reenviar código"}
            </Button>
          </div>
        </form>
      )}

      {step === "method" && (
        <form onSubmit={requestMethodChange} className="space-y-3">
          <div>
            <Label htmlFor="method-change-new-method">Novo método</Label>
            <select
              id="method-change-new-method"
              className="w-full rounded-md border bg-background p-2"
              value={newMethod}
              onChange={(event) => setNewMethod(event.target.value as TwoFactorMethod)}
            >
              <option value="">Selecione</option>
              {options.map((option) => (
                <option key={option} value={option}>
                  {option === "EMAIL" ? "E-mail" : "SMS"}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={busy}>
            {actions.changeRequestPending ? "Solicitando..." : "Solicitar troca"}
          </Button>
        </form>
      )}

      {step === "confirm" && methodChallenge && (
        <form onSubmit={confirmMethodChange} className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Código enviado ao novo método. Expira em {formatDate(methodChallenge.expiresAt)}.
          </p>
          <div>
            <Label htmlFor="method-change-confirm-code">Código de confirmação</Label>
            <Input
              id="method-change-confirm-code"
              inputMode="numeric"
              maxLength={6}
              value={methodCode}
              onChange={(event) => setMethodCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </div>
          <Button type="submit" disabled={busy}>
            {actions.changeConfirmPending ? "Confirmando..." : "Confirmar troca"}
          </Button>
        </form>
      )}

      {reconciling && (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Atualizando o status real da segurança...</p>
          {reconciliationError && (
            <Button type="button" variant="outline" onClick={() => void retryReconcile()}>
              Tentar reconciliar novamente
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
