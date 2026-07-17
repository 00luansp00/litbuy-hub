import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ApiError, setAccessToken } from "@/lib/api/client";
import { useAuth } from "@/providers/AuthContext";
import { accountSecurityQueryKeys } from "./useAccountSecurity";
import {
  twoFactorSecurityService,
  type StepUpVerifyPayload,
  type TwoFactorDisableConfirmPayload,
  type TwoFactorEnrollRequestPayload,
  type TwoFactorMethod,
} from "./twoFactorSecurity";

export const twoFactorStatusQueryKey = ["auth", "2fa", "status"] as const;
const privateQuery = (queryKey: readonly unknown[]) => queryKey[0] !== "public";

function useMountedRef() {
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  return mountedRef;
}

export function useTwoFactorStatus(enabled: boolean) {
  return useQuery({
    queryKey: twoFactorStatusQueryKey,
    queryFn: twoFactorSecurityService.getStatus,
    enabled,
    retry: false,
  });
}

export function useTwoFactorSecurity() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { clearAuthentication } = useAuth();
  const mountedRef = useMountedRef();
  const [requestPending, setRequestPending] = useState(false);
  const [confirmPending, setConfirmPending] = useState(false);
  const [disablePending, setDisablePending] = useState(false);
  const [disableConfirmPending, setDisableConfirmPending] = useState(false);
  const requestInFlight = useRef(false);
  const confirmInFlight = useRef(false);
  const disableInFlight = useRef(false);
  const disableConfirmInFlight = useRef(false);

  const refreshTwoFactorRelatedData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: twoFactorStatusQueryKey }),
      queryClient.invalidateQueries({ queryKey: accountSecurityQueryKeys.sessions }),
    ]).catch(() => undefined);
  };

  const requestEnrollment = async (payload: TwoFactorEnrollRequestPayload) => {
    if (requestInFlight.current) throw new Error("TWO_FACTOR_REQUEST_IN_FLIGHT");
    requestInFlight.current = true;
    setRequestPending(true);
    try {
      return await twoFactorSecurityService.requestEnrollment(payload);
    } finally {
      requestInFlight.current = false;
      if (mountedRef.current) setRequestPending(false);
    }
  };

  const confirmEnrollment = async (payload: { challengeId: string; code: string }) => {
    if (confirmInFlight.current) throw new Error("TWO_FACTOR_CONFIRM_IN_FLIGHT");
    confirmInFlight.current = true;
    setConfirmPending(true);
    try {
      return await twoFactorSecurityService.confirmEnrollment(payload);
    } finally {
      confirmInFlight.current = false;
      if (mountedRef.current) setConfirmPending(false);
    }
  };

  const requestDisable = async (payload: { currentPassword: string }) => {
    if (disableInFlight.current) throw new Error("TWO_FACTOR_DISABLE_IN_FLIGHT");
    disableInFlight.current = true;
    setDisablePending(true);
    try {
      return await twoFactorSecurityService.requestDisable(payload);
    } finally {
      disableInFlight.current = false;
      if (mountedRef.current) setDisablePending(false);
    }
  };

  const confirmDisable = async (payload: TwoFactorDisableConfirmPayload) => {
    if (disableConfirmInFlight.current) throw new Error("TWO_FACTOR_DISABLE_CONFIRM_IN_FLIGHT");
    disableConfirmInFlight.current = true;
    setDisableConfirmPending(true);
    try {
      const response = await twoFactorSecurityService.confirmDisable(payload);
      setAccessToken(null);
      await queryClient
        .cancelQueries({ predicate: (q) => privateQuery(q.queryKey) })
        .catch(() => undefined);
      queryClient.removeQueries({ predicate: (q) => privateQuery(q.queryKey) });
      clearAuthentication();
      navigate({ to: "/login" });
      toast.info("2FA desativado. Entre novamente para continuar.");
      return response;
    } finally {
      disableConfirmInFlight.current = false;
      if (mountedRef.current) setDisableConfirmPending(false);
    }
  };

  return {
    requestEnrollment,
    confirmEnrollment,
    requestDisable,
    confirmDisable,
    requestPending,
    confirmPending,
    disablePending,
    disableConfirmPending,
    refreshTwoFactorRelatedData,
  };
}

const unusableGrantCodes = new Set([
  "STEP_UP_REQUIRED",
  "INVALID_OR_EXPIRED_STEP_UP_GRANT",
  "STEP_UP_SCOPE_MISMATCH",
  "INVALID_SESSION",
  "FORBIDDEN",
  "TWO_FACTOR_METHOD_CHANGE_OUTCOME_UNKNOWN",
]);

export function useTwoFactorMethodChange() {
  const queryClient = useQueryClient();
  const mountedRef = useMountedRef();
  const stepUpTokenRef = useRef<string | null>(null);
  const [stepUpPending, setStepUpPending] = useState(false);
  const [verifyPending, setVerifyPending] = useState(false);
  const [resendPending, setResendPending] = useState(false);
  const [changeRequestPending, setChangeRequestPending] = useState(false);
  const [changeConfirmPending, setChangeConfirmPending] = useState(false);
  const stepUpInFlight = useRef(false);
  const verifyInFlight = useRef(false);
  const resendInFlight = useRef(false);
  const changeRequestInFlight = useRef(false);
  const changeConfirmInFlight = useRef(false);

  const clearGrant = () => {
    stepUpTokenRef.current = null;
  };

  useEffect(() => clearGrant, []);

  const refreshMethodChangeRelatedData = async () => {
    await queryClient.fetchQuery({
      queryKey: twoFactorStatusQueryKey,
      queryFn: twoFactorSecurityService.getStatus,
    });
    await queryClient.invalidateQueries({ queryKey: accountSecurityQueryKeys.sessions });
    await queryClient.refetchQueries({
      queryKey: accountSecurityQueryKeys.sessions,
      type: "active",
    });
  };

  const requestStepUp = async (payload: { currentPassword: string }) => {
    if (stepUpInFlight.current) throw new Error("STEP_UP_REQUEST_IN_FLIGHT");
    stepUpInFlight.current = true;
    setStepUpPending(true);
    try {
      return await twoFactorSecurityService.requestStepUp({
        scope: "TWO_FACTOR_METHOD_CHANGE",
        currentPassword: payload.currentPassword,
      });
    } finally {
      stepUpInFlight.current = false;
      if (mountedRef.current) setStepUpPending(false);
    }
  };

  const verifyStepUp = async (payload: StepUpVerifyPayload) => {
    if (verifyInFlight.current) throw new Error("STEP_UP_VERIFY_IN_FLIGHT");
    verifyInFlight.current = true;
    setVerifyPending(true);
    try {
      const grant = await twoFactorSecurityService.verifyStepUp(payload);
      if (!mountedRef.current) {
        clearGrant();
        return grant;
      }
      stepUpTokenRef.current = grant.stepUpToken;
      return grant;
    } finally {
      verifyInFlight.current = false;
      if (mountedRef.current) setVerifyPending(false);
    }
  };

  const resendStepUp = async (payload: { challengeId: string }) => {
    if (resendInFlight.current) throw new Error("STEP_UP_RESEND_IN_FLIGHT");
    resendInFlight.current = true;
    setResendPending(true);
    try {
      return await twoFactorSecurityService.resendStepUp(payload);
    } finally {
      resendInFlight.current = false;
      if (mountedRef.current) setResendPending(false);
    }
  };

  const requestMethodChange = async (payload: { newMethod: TwoFactorMethod }) => {
    if (changeRequestInFlight.current) throw new Error("METHOD_CHANGE_REQUEST_IN_FLIGHT");
    if (!stepUpTokenRef.current)
      throw new ApiError(400, "STEP_UP_REQUIRED", "Step-up obrigatório.");
    changeRequestInFlight.current = true;
    setChangeRequestPending(true);
    try {
      return await twoFactorSecurityService.requestMethodChange(payload, stepUpTokenRef.current);
    } catch (error) {
      if (error instanceof ApiError && unusableGrantCodes.has(error.code)) clearGrant();
      throw error;
    } finally {
      changeRequestInFlight.current = false;
      if (mountedRef.current) setChangeRequestPending(false);
    }
  };

  const confirmMethodChange = async (payload: { challengeId: string; code: string }) => {
    if (changeConfirmInFlight.current) throw new Error("METHOD_CHANGE_CONFIRM_IN_FLIGHT");
    if (!stepUpTokenRef.current)
      throw new ApiError(400, "STEP_UP_REQUIRED", "Step-up obrigatório.");
    changeConfirmInFlight.current = true;
    setChangeConfirmPending(true);
    try {
      const response = await twoFactorSecurityService.confirmMethodChange(
        payload,
        stepUpTokenRef.current,
      );
      clearGrant();
      return response;
    } catch (error) {
      if (
        error instanceof ApiError &&
        (unusableGrantCodes.has(error.code) || error.code === "TWO_FACTOR_METHOD_CHANGE_CONFLICT")
      ) {
        clearGrant();
      }
      throw error;
    } finally {
      changeConfirmInFlight.current = false;
      if (mountedRef.current) setChangeConfirmPending(false);
    }
  };

  return {
    requestStepUp,
    verifyStepUp,
    resendStepUp,
    requestMethodChange,
    confirmMethodChange,
    clearGrant,
    refreshMethodChangeRelatedData,
    stepUpPending,
    verifyPending,
    resendPending,
    changeRequestPending,
    changeConfirmPending,
  };
}
