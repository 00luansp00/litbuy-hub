import { useEffect, useRef, useState } from "react";
import { stepUpSecurityService, type StepUpVerifyPayload } from "./stepUpSecurity";
import {
  twoFactorMethodChangeService,
  type TwoFactorMethodChangeConfirmPayload,
  type TwoFactorMethodChangeRequestPayload,
} from "./twoFactorMethodChange";

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

export function useTwoFactorMethodChange() {
  const mountedRef = useMountedRef();
  const stepUpTokenRef = useRef("");
  const inFlight = useRef({
    request: false,
    verify: false,
    resend: false,
    change: false,
    confirm: false,
  });
  const [requestPending, setRequestPending] = useState(false);
  const [verifyPending, setVerifyPending] = useState(false);
  const [resendPending, setResendPending] = useState(false);
  const [changePending, setChangePending] = useState(false);
  const [confirmPending, setConfirmPending] = useState(false);

  const clearGrant = () => {
    stepUpTokenRef.current = "";
  };
  useEffect(() => clearGrant, []);

  const requestStepUp = async (currentPassword: string) => {
    if (inFlight.current.request) throw new Error("METHOD_CHANGE_STEP_UP_REQUEST_IN_FLIGHT");
    clearGrant();
    inFlight.current.request = true;
    setRequestPending(true);
    try {
      return await stepUpSecurityService.requestMethodChangeStepUp(currentPassword);
    } finally {
      inFlight.current.request = false;
      if (mountedRef.current) setRequestPending(false);
    }
  };

  const resendStepUp = async (challengeId: string) => {
    if (inFlight.current.resend) throw new Error("METHOD_CHANGE_STEP_UP_RESEND_IN_FLIGHT");
    inFlight.current.resend = true;
    setResendPending(true);
    try {
      return await stepUpSecurityService.resendMethodChangeStepUp(challengeId);
    } finally {
      inFlight.current.resend = false;
      if (mountedRef.current) setResendPending(false);
    }
  };

  const verifyStepUp = async (payload: StepUpVerifyPayload) => {
    if (inFlight.current.verify) throw new Error("METHOD_CHANGE_STEP_UP_VERIFY_IN_FLIGHT");
    clearGrant();
    inFlight.current.verify = true;
    setVerifyPending(true);
    try {
      const grant = await stepUpSecurityService.verifyMethodChangeStepUp(payload);
      if (!mountedRef.current) {
        clearGrant();
        return grant;
      }
      stepUpTokenRef.current = grant.stepUpToken;
      return grant;
    } finally {
      inFlight.current.verify = false;
      if (mountedRef.current) setVerifyPending(false);
    }
  };

  const requestMethodChange = async (payload: TwoFactorMethodChangeRequestPayload) => {
    if (inFlight.current.change) throw new Error("METHOD_CHANGE_REQUEST_IN_FLIGHT");
    inFlight.current.change = true;
    setChangePending(true);
    try {
      return await twoFactorMethodChangeService.request(payload, stepUpTokenRef.current);
    } catch (error) {
      if (error instanceof Error && "code" in error) {
        const code = String(error.code);
        if (
          [
            "STEP_UP_REQUIRED",
            "INVALID_OR_EXPIRED_STEP_UP_GRANT",
            "STEP_UP_SCOPE_MISMATCH",
            "INVALID_SESSION",
            "FORBIDDEN",
            "TWO_FACTOR_METHOD_CHANGE_CONFLICT",
          ].includes(code)
        )
          clearGrant();
      }
      throw error;
    } finally {
      inFlight.current.change = false;
      if (mountedRef.current) setChangePending(false);
    }
  };

  const confirmMethodChange = async (payload: TwoFactorMethodChangeConfirmPayload) => {
    if (inFlight.current.confirm) throw new Error("METHOD_CHANGE_CONFIRM_IN_FLIGHT");
    inFlight.current.confirm = true;
    setConfirmPending(true);
    try {
      const result = await twoFactorMethodChangeService.confirm(payload, stepUpTokenRef.current);
      clearGrant();
      return result;
    } catch (error) {
      if (error instanceof Error && "code" in error) {
        const code = String(error.code);
        if (
          [
            "STEP_UP_REQUIRED",
            "INVALID_OR_EXPIRED_STEP_UP_GRANT",
            "STEP_UP_SCOPE_MISMATCH",
            "INVALID_SESSION",
            "FORBIDDEN",
            "TWO_FACTOR_METHOD_CHANGE_OUTCOME_UNKNOWN",
            "TWO_FACTOR_METHOD_CHANGE_CONFLICT",
          ].includes(code)
        )
          clearGrant();
      }
      throw error;
    } finally {
      inFlight.current.confirm = false;
      if (mountedRef.current) setConfirmPending(false);
    }
  };

  return {
    requestStepUp,
    resendStepUp,
    verifyStepUp,
    requestMethodChange,
    confirmMethodChange,
    clearGrant,
    requestPending,
    verifyPending,
    resendPending,
    changePending,
    confirmPending,
  };
}
