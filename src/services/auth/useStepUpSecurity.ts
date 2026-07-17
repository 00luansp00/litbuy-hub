import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { accountSecurityQueryKeys } from "./useAccountSecurity";
import { twoFactorStatusQueryKey } from "./useTwoFactorSecurity";
import { stepUpSecurityService, type StepUpVerifyPayload } from "./stepUpSecurity";

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

export function useStepUpSecurity() {
  const queryClient = useQueryClient();
  const mountedRef = useMountedRef();
  const inFlight = useRef({ request: false, verify: false, resend: false, reconcile: false });
  const [requestPending, setRequestPending] = useState(false);
  const [verifyPending, setVerifyPending] = useState(false);
  const [resendPending, setResendPending] = useState(false);
  const [reconcilePending, setReconcilePending] = useState(false);

  const refreshStepUpRelatedData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: twoFactorStatusQueryKey }),
      queryClient.invalidateQueries({ queryKey: accountSecurityQueryKeys.sessions }),
    ]).catch(() => undefined);
  };

  const reconcileStepUpRelatedData = async () => {
    if (inFlight.current.reconcile) throw new Error("STEP_UP_RECONCILE_IN_FLIGHT");
    inFlight.current.reconcile = true;
    setReconcilePending(true);
    try {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: twoFactorStatusQueryKey }, { throwOnError: true }),
        queryClient.refetchQueries(
          { queryKey: accountSecurityQueryKeys.sessions },
          { throwOnError: true },
        ),
      ]);
    } finally {
      inFlight.current.reconcile = false;
      if (mountedRef.current) setReconcilePending(false);
    }
  };

  const requestStepUp = async (currentPassword: string) => {
    if (inFlight.current.request) throw new Error("STEP_UP_REQUEST_IN_FLIGHT");
    inFlight.current.request = true;
    setRequestPending(true);
    try {
      return await stepUpSecurityService.requestStepUp(currentPassword);
    } finally {
      inFlight.current.request = false;
      if (mountedRef.current) setRequestPending(false);
    }
  };

  const resendStepUp = async (challengeId: string) => {
    if (inFlight.current.resend) throw new Error("STEP_UP_RESEND_IN_FLIGHT");
    inFlight.current.resend = true;
    setResendPending(true);
    try {
      return await stepUpSecurityService.resendStepUp(challengeId);
    } finally {
      inFlight.current.resend = false;
      if (mountedRef.current) setResendPending(false);
    }
  };

  const verifyStepUpAndRegenerateRecoveryCodes = async (payload: StepUpVerifyPayload) => {
    if (inFlight.current.verify) throw new Error("STEP_UP_VERIFY_IN_FLIGHT");
    inFlight.current.verify = true;
    setVerifyPending(true);
    try {
      return await stepUpSecurityService.verifyStepUpAndRegenerateRecoveryCodes(payload);
    } finally {
      inFlight.current.verify = false;
      if (mountedRef.current) setVerifyPending(false);
    }
  };

  return {
    requestStepUp,
    resendStepUp,
    verifyStepUpAndRegenerateRecoveryCodes,
    refreshStepUpRelatedData,
    reconcileStepUpRelatedData,
    requestPending,
    verifyPending,
    resendPending,
    reconcilePending,
  };
}
