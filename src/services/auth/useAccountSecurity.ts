import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { setAccessToken } from "@/lib/api/client";
import { useAuth } from "@/providers/AuthContext";
import { friendlyAuthError } from "./errors";
import { authSecurityService, type ChangePasswordPayload } from "./security";

export const accountSecurityQueryKeys = {
  sessions: ["auth", "sessions"] as const,
  devices: ["auth", "devices"] as const,
};

export function useAccountSecurityQueries(enabled: boolean) {
  const sessions = useQuery({
    queryKey: accountSecurityQueryKeys.sessions,
    queryFn: authSecurityService.listSessions,
    enabled,
    staleTime: 30_000,
  });
  const devices = useQuery({
    queryKey: accountSecurityQueryKeys.devices,
    queryFn: authSecurityService.listDevices,
    enabled,
    staleTime: 30_000,
  });
  return { sessions, devices };
}

export function useAccountSecurityMutations() {
  const queryClient = useQueryClient();
  const nav = useNavigate();
  const { clearAuthentication } = useAuth();

  const invalidatePrivateSecurity = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: accountSecurityQueryKeys.sessions }),
      queryClient.invalidateQueries({ queryKey: accountSecurityQueryKeys.devices }),
    ]);
  };

  const endCurrentSession = (message: string) => {
    setAccessToken(null);
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "public" });
    clearAuthentication();
    toast.info(message);
    nav({ to: "/login" });
  };

  const revokeSession = useMutation({
    mutationFn: authSecurityService.revokeSession,
    onSuccess: async (_result, sessionId) => {
      const current = queryClient
        .getQueryData<
          Awaited<ReturnType<typeof authSecurityService.listSessions>>
        >(accountSecurityQueryKeys.sessions)
        ?.sessions.find((session) => session.id === sessionId)?.current;
      if (current) endCurrentSession("Sessão encerrada. Entre novamente para continuar.");
      else {
        await invalidatePrivateSecurity();
        toast.success("Sessão revogada.");
      }
    },
    onError: (error) => toast.error(friendlyAuthError(error).message),
  });

  const revokeOtherSessions = useMutation({
    mutationFn: authSecurityService.revokeOtherSessions,
    onSuccess: () => endCurrentSession("Todas as sessões foram encerradas. Entre novamente."),
    onError: (error) => toast.error(friendlyAuthError(error).message),
  });

  const revokeDevice = useMutation({
    mutationFn: authSecurityService.revokeDevice,
    onSuccess: async (_result, deviceId) => {
      const current = queryClient
        .getQueryData<
          Awaited<ReturnType<typeof authSecurityService.listDevices>>
        >(accountSecurityQueryKeys.devices)
        ?.devices.find((device) => device.id === deviceId)?.current;
      if (current)
        endCurrentSession("Dispositivo revogado. Entre novamente em um dispositivo aprovado.");
      else {
        await invalidatePrivateSecurity();
        toast.success("Dispositivo revogado.");
      }
    },
    onError: (error) => toast.error(friendlyAuthError(error).message),
  });

  const changePassword = useMutation({
    mutationFn: (payload: ChangePasswordPayload) => authSecurityService.changePassword(payload),
    onSuccess: () => endCurrentSession("Senha alterada. Faça login novamente."),
    onError: (error) => toast.error(friendlyAuthError(error).message),
  });

  return { revokeSession, revokeOtherSessions, revokeDevice, changePassword };
}
