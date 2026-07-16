import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { setAccessToken } from "@/lib/api/client";
import { useAuth } from "@/providers/AuthContext";
import { accountSecurityQueryKeys } from "./useAccountSecurity";
import {
  twoFactorSecurityService,
  type TwoFactorDisableConfirmPayload,
  type TwoFactorEnrollRequestPayload,
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
