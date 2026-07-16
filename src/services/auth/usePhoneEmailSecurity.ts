import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { setAccessToken } from "@/lib/api/client";
import { useAuth } from "@/providers/AuthContext";
import { friendlyAuthError } from "./errors";
import {
  phoneEmailSecurityService,
  type EmailChangeConfirmPayload,
  type EmailChangeRequestPayload,
  type PhoneRequestPayload,
  type PhoneVerifyPayload,
} from "./phoneEmailSecurity";

export function useEndRevokedAuthentication() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { clearAuthentication } = useAuth();
  return (message: string) => {
    setAccessToken(null);
    queryClient.cancelQueries({ predicate: (q) => q.queryKey[0] !== "public" });
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "public" });
    clearAuthentication();
    toast.info(message);
    navigate({ to: "/login" });
  };
}

export function usePhoneSecurity() {
  const endRevokedAuthentication = useEndRevokedAuthentication();
  const requestPhone = useMutation({
    mutationFn: (payload: PhoneRequestPayload) =>
      phoneEmailSecurityService.requestPhoneVerification(payload),
    onError: (error) => toast.error(friendlyAuthError(error).message),
  });
  const verifyPhone = useMutation({
    mutationFn: (payload: PhoneVerifyPayload) => phoneEmailSecurityService.verifyPhone(payload),
    onSuccess: () =>
      endRevokedAuthentication("Telefone confirmado. Entre novamente para continuar."),
    onError: (error) => toast.error(friendlyAuthError(error).message),
  });
  return { requestPhone, verifyPhone };
}

export function useEmailSecurity() {
  const endRevokedAuthentication = useEndRevokedAuthentication();
  const requestEmailChange = useMutation({
    mutationFn: (payload: EmailChangeRequestPayload) =>
      phoneEmailSecurityService.requestEmailChange(payload),
    onSuccess: () => toast.success("Enviamos confirmações para os dois e-mails."),
    onError: (error) => toast.error(friendlyAuthError(error).message),
  });
  const confirmEmailChange = useMutation({
    mutationFn: (payload: EmailChangeConfirmPayload) =>
      phoneEmailSecurityService.confirmEmailChange(payload),
    onSuccess: (result) => {
      if (result.status === "COMPLETED")
        endRevokedAuthentication("E-mail alterado. Entre com o novo e-mail.");
      else toast.info("Confirmação registrada. Aguarde a outra confirmação.");
    },
    onError: (error) => toast.error(friendlyAuthError(error).message),
  });
  return { requestEmailChange, confirmEmailChange };
}
