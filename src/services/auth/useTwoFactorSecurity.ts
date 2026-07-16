import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { accountSecurityQueryKeys } from "./useAccountSecurity";
import { useEndRevokedAuthentication } from "./usePhoneEmailSecurity";
import {
  twoFactorSecurityService,
  type TwoFactorChallengeResponse,
  type TwoFactorDisableConfirmPayload,
  type TwoFactorDisableRequestPayload,
  type TwoFactorEnrollConfirmPayload,
  type TwoFactorEnrollConfirmResponse,
  type TwoFactorEnrollRequestPayload,
} from "./twoFactorSecurity";

export const twoFactorQueryKeys = { status: ["auth", "2fa", "status"] as const };

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
    queryKey: twoFactorQueryKeys.status,
    queryFn: twoFactorSecurityService.getTwoFactorStatus,
    enabled,
    staleTime: 30_000,
  });
}

export function useTwoFactorSecurityActions() {
  const mountedRef = useMountedRef();
  const queryClient = useQueryClient();
  const endRevokedAuthentication = useEndRevokedAuthentication();
  const enrollRequestInFlight = useRef(false);
  const enrollConfirmInFlight = useRef(false);
  const disableRequestInFlight = useRef(false);
  const disableConfirmInFlight = useRef(false);
  const [enrollRequestPending, setEnrollRequestPending] = useState(false);
  const [enrollConfirmPending, setEnrollConfirmPending] = useState(false);
  const [disableRequestPending, setDisableRequestPending] = useState(false);
  const [disableConfirmPending, setDisableConfirmPending] = useState(false);

  const refreshTwoFactorSecurity = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: twoFactorQueryKeys.status }),
      queryClient.invalidateQueries({ queryKey: accountSecurityQueryKeys.sessions }),
      queryClient.invalidateQueries({ queryKey: accountSecurityQueryKeys.devices }),
    ]);
  };

  const requestEnrollment = async (
    payload: TwoFactorEnrollRequestPayload,
  ): Promise<TwoFactorChallengeResponse> => {
    if (enrollRequestInFlight.current) throw new Error("TWO_FACTOR_ENROLL_REQUEST_IN_FLIGHT");
    enrollRequestInFlight.current = true;
    setEnrollRequestPending(true);
    try {
      return await twoFactorSecurityService.requestTwoFactorEnrollment(payload);
    } finally {
      enrollRequestInFlight.current = false;
      if (mountedRef.current) setEnrollRequestPending(false);
    }
  };

  const confirmEnrollment = async (
    payload: TwoFactorEnrollConfirmPayload,
  ): Promise<TwoFactorEnrollConfirmResponse> => {
    if (enrollConfirmInFlight.current) throw new Error("TWO_FACTOR_ENROLL_CONFIRM_IN_FLIGHT");
    enrollConfirmInFlight.current = true;
    setEnrollConfirmPending(true);
    try {
      const response = await twoFactorSecurityService.confirmTwoFactorEnrollment(payload);
      await refreshTwoFactorSecurity();
      return response;
    } finally {
      enrollConfirmInFlight.current = false;
      if (mountedRef.current) setEnrollConfirmPending(false);
    }
  };

  const requestDisable = async (
    payload: TwoFactorDisableRequestPayload,
  ): Promise<TwoFactorChallengeResponse> => {
    if (disableRequestInFlight.current) throw new Error("TWO_FACTOR_DISABLE_REQUEST_IN_FLIGHT");
    disableRequestInFlight.current = true;
    setDisableRequestPending(true);
    try {
      return await twoFactorSecurityService.requestTwoFactorDisable(payload);
    } finally {
      disableRequestInFlight.current = false;
      if (mountedRef.current) setDisableRequestPending(false);
    }
  };

  const confirmDisable = async (payload: TwoFactorDisableConfirmPayload) => {
    if (disableConfirmInFlight.current) throw new Error("TWO_FACTOR_DISABLE_CONFIRM_IN_FLIGHT");
    disableConfirmInFlight.current = true;
    setDisableConfirmPending(true);
    try {
      const response = await twoFactorSecurityService.confirmTwoFactorDisable(payload);
      await endRevokedAuthentication("2FA desativado. Entre novamente para continuar.");
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
    enrollRequestPending,
    enrollConfirmPending,
    disableRequestPending,
    disableConfirmPending,
  };
}
