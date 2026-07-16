import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { setAccessToken } from "@/lib/api/client";
import { useAuth } from "@/providers/AuthContext";
import { friendlyAuthError } from "./errors";
import {
  phoneEmailSecurityService,
  type EmailChangeConfirmPayload,
  type EmailChangeConfirmResponse,
  type EmailChangeRequestPayload,
  type EmailChangeRequestResponse,
  type PhoneRequestPayload,
  type PhoneRequestResponse,
  type PhoneVerifyPayload,
} from "./phoneEmailSecurity";

const privateQuery = (queryKey: readonly unknown[]) => queryKey[0] !== "public";

export function useEndRevokedAuthentication() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { clearAuthentication } = useAuth();
  return async (message: string) => {
    setAccessToken(null);
    await queryClient
      .cancelQueries({ predicate: (q) => privateQuery(q.queryKey) })
      .catch(() => undefined);
    queryClient.removeQueries({ predicate: (q) => privateQuery(q.queryKey) });
    clearAuthentication();
    navigate({ to: "/login" });
    toast.info(message);
  };
}

export function usePhoneSecurity() {
  const endRevokedAuthentication = useEndRevokedAuthentication();
  const [requestPending, setRequestPending] = useState(false);
  const [verifyPending, setVerifyPending] = useState(false);
  const requestInFlight = useRef(false);
  const verifyInFlight = useRef(false);

  const requestPhone = async (payload: PhoneRequestPayload): Promise<PhoneRequestResponse> => {
    if (requestInFlight.current) throw new Error("PHONE_REQUEST_IN_FLIGHT");
    requestInFlight.current = true;
    setRequestPending(true);
    try {
      return await phoneEmailSecurityService.requestPhoneVerification(payload);
    } catch (error) {
      toast.error(friendlyAuthError(error).message);
      throw error;
    } finally {
      requestInFlight.current = false;
      setRequestPending(false);
    }
  };

  const verifyPhone = async (payload: PhoneVerifyPayload) => {
    if (verifyInFlight.current) throw new Error("PHONE_VERIFY_IN_FLIGHT");
    verifyInFlight.current = true;
    setVerifyPending(true);
    try {
      const response = await phoneEmailSecurityService.verifyPhone(payload);
      await endRevokedAuthentication("Telefone confirmado. Entre novamente para continuar.");
      return response;
    } catch (error) {
      toast.error(friendlyAuthError(error).message);
      throw error;
    } finally {
      verifyInFlight.current = false;
      setVerifyPending(false);
    }
  };

  return { requestPhone, verifyPhone, requestPending, verifyPending };
}

export function useEmailSecurity() {
  const endRevokedAuthentication = useEndRevokedAuthentication();
  const [requestPending, setRequestPending] = useState(false);
  const [confirmPending, setConfirmPending] = useState(false);
  const requestInFlight = useRef(false);
  const confirmInFlight = useRef(false);

  const requestEmailChange = async (
    payload: EmailChangeRequestPayload,
  ): Promise<EmailChangeRequestResponse> => {
    if (requestInFlight.current) throw new Error("EMAIL_REQUEST_IN_FLIGHT");
    requestInFlight.current = true;
    setRequestPending(true);
    try {
      const response = await phoneEmailSecurityService.requestEmailChange(payload);
      toast.success("Enviamos confirmações para os dois e-mails.");
      return response;
    } catch (error) {
      toast.error(friendlyAuthError(error).message);
      throw error;
    } finally {
      requestInFlight.current = false;
      setRequestPending(false);
    }
  };

  const confirmEmailChange = async (
    payload: EmailChangeConfirmPayload,
  ): Promise<EmailChangeConfirmResponse> => {
    if (confirmInFlight.current) throw new Error("EMAIL_CONFIRM_IN_FLIGHT");
    confirmInFlight.current = true;
    setConfirmPending(true);
    try {
      const result = await phoneEmailSecurityService.confirmEmailChange(payload);
      if (result.status === "COMPLETED") {
        await endRevokedAuthentication("E-mail alterado. Entre com o novo e-mail.");
      } else {
        toast.info("Confirmação registrada. Aguarde a outra confirmação.");
      }
      return result;
    } catch (error) {
      toast.error(friendlyAuthError(error).message);
      throw error;
    } finally {
      confirmInFlight.current = false;
      setConfirmPending(false);
    }
  };

  return { requestEmailChange, confirmEmailChange, requestPending, confirmPending };
}
