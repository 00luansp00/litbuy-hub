import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { ShieldCheck, Smartphone, Monitor, KeyRound, Loader2 } from "lucide-react";
import { AuthGate } from "@/components/auth/AuthGate";
import { AccountHeader } from "@/components/account/AccountHeader";
import { AccountLayout } from "@/components/account/AccountLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/providers/AuthContext";
import {
  friendlyAuthError,
  useAccountSecurityMutations,
  useAccountSecurityQueries,
} from "@/services/auth";
import type { AuthDevice, AuthSession } from "@/services/auth";

export const Route = createFileRoute("/perfil/seguranca")({ component: AccountSecurityPage });

type ConfirmAction =
  | { kind: "session"; id: string; title: string; description: string }
  | { kind: "device"; id: string; title: string; description: string }
  | { kind: "logoutAll"; id: "all"; title: string; description: string };

function formatDate(value: string | null | undefined) {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function shortAgent(agent: string | null) {
  if (!agent) return "Navegador não informado";
  return agent.length > 86 ? `${agent.slice(0, 86)}…` : agent;
}

function SecurityListState({
  loading,
  error,
  empty,
}: {
  loading: boolean;
  error: unknown;
  empty: boolean;
}) {
  if (loading)
    return (
      <p className="text-sm text-muted-foreground">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
        Carregando dados reais da API...
      </p>
    );
  if (error)
    return (
      <p role="alert" className="text-sm text-destructive">
        {friendlyAuthError(error).message}
      </p>
    );
  if (empty)
    return <p className="text-sm text-muted-foreground">Nenhum registro ativo encontrado.</p>;
  return null;
}

function SessionCard({
  session,
  onRevoke,
}: {
  session: AuthSession;
  onRevoke: (s: AuthSession) => void;
}) {
  return (
    <li className="rounded-2xl border border-border bg-surface/60 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Monitor className="h-4 w-4 text-primary" aria-hidden="true" />
            <h3 className="font-semibold text-foreground">
              {session.deviceName ?? "Sessão do navegador"}
            </h3>
            {session.current && <Badge>Sessão atual</Badge>}
            {session.revoked && <Badge variant="outline">Revogada</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{shortAgent(session.userAgent)}</p>
          <dl className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
            <div>
              <dt className="font-medium text-foreground">Criada</dt>
              <dd>{formatDate(session.createdAt)}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Última atividade</dt>
              <dd>{formatDate(session.lastUsedAt)}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Expira</dt>
              <dd>{formatDate(session.expiresAt)}</dd>
            </div>
          </dl>
        </div>
        <Button variant="outline" disabled={session.revoked} onClick={() => onRevoke(session)}>
          Revogar sessão
        </Button>
      </div>
    </li>
  );
}

function DeviceCard({
  device,
  onRevoke,
}: {
  device: AuthDevice;
  onRevoke: (d: AuthDevice) => void;
}) {
  const disabled = device.status === "REVOKED";
  return (
    <li className="rounded-2xl border border-border bg-surface/60 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Smartphone className="h-4 w-4 text-primary" aria-hidden="true" />
            <h3 className="font-semibold text-foreground">
              {device.displayName ?? "Dispositivo aprovado"}
            </h3>
            {device.current && <Badge>Dispositivo atual</Badge>}
            <Badge variant="outline">{device.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{shortAgent(device.userAgent)}</p>
          <dl className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
            <div>
              <dt className="font-medium text-foreground">Aprovado</dt>
              <dd>{formatDate(device.approvedAt)}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Primeiro uso</dt>
              <dd>{formatDate(device.firstSeenAt)}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Último uso</dt>
              <dd>{formatDate(device.lastSeenAt)}</dd>
            </div>
          </dl>
        </div>
        <Button variant="outline" disabled={disabled} onClick={() => onRevoke(device)}>
          Revogar dispositivo
        </Button>
      </div>
    </li>
  );
}

function PasswordForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (p: { currentPassword: string; newPassword: string }) => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    let next = "";
    if (!currentPassword) next = "Informe a senha atual.";
    else if (newPassword.length < 12) next = "A nova senha precisa ter pelo menos 12 caracteres.";
    else if (newPassword !== confirm) next = "As senhas não conferem.";
    else if (newPassword === currentPassword)
      next = "A nova senha deve ser diferente da senha atual.";
    if (next) {
      setMessage(next);
      window.setTimeout(() => errorRef.current?.focus(), 0);
      return;
    }
    setMessage("");
    onSubmit({ currentPassword, newPassword });
    setCurrentPassword("");
    setNewPassword("");
    setConfirm("");
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <p ref={errorRef} tabIndex={-1} aria-live="polite" className="text-sm text-destructive">
        {message}
      </p>
      <div>
        <Label htmlFor="current-password">Senha atual</Label>
        <Input
          id="current-password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="new-password">Nova senha</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="confirm-password">Confirmar nova senha</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <Button disabled={pending} type="submit">
        {pending ? "Alterando senha..." : "Alterar senha"}
      </Button>
      <p className="text-xs text-muted-foreground">
        A API revoga todas as sessões ao alterar senha; será necessário entrar novamente.
      </p>
    </form>
  );
}

function AccountSecurityPage() {
  const { isAuthenticated } = useAuth();
  const { sessions, devices } = useAccountSecurityQueries(isAuthenticated);
  const mutations = useAccountSecurityMutations();
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const activeSessions = useMemo(
    () => sessions.data?.sessions.filter((s) => !s.revoked) ?? [],
    [sessions.data],
  );
  const approvedDevices = useMemo(
    () => devices.data?.devices.filter((d) => d.status === "APPROVED") ?? [],
    [devices.data],
  );
  const busy =
    mutations.revokeSession.isPending ||
    mutations.revokeDevice.isPending ||
    mutations.revokeOtherSessions.isPending;
  const confirmAction = () => {
    if (!confirm || busy) return;
    if (confirm.kind === "session") mutations.revokeSession.mutate(confirm.id);
    if (confirm.kind === "device") mutations.revokeDevice.mutate(confirm.id);
    if (confirm.kind === "logoutAll") mutations.revokeOtherSessions.mutate();
    setConfirm(null);
  };
  return (
    <AuthGate>
      <AccountLayout
        header={<AccountHeader />}
        title="Segurança da conta"
        description="Gerencie sessões, dispositivos aprovados e senha usando apenas a API real NestJS."
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" /> Resumo de segurança
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
            <p>
              <strong className="text-foreground">{activeSessions.length}</strong> sessões ativas.
            </p>
            <p>
              <strong className="text-foreground">{approvedDevices.length}</strong> dispositivos
              aprovados.
            </p>
            <p>Nenhum token, senha ou ID é persistido no navegador por esta página.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Sessões ativas</CardTitle>
            <Button
              variant="outline"
              onClick={() =>
                setConfirm({
                  kind: "logoutAll",
                  id: "all",
                  title: "Encerrar todas as sessões",
                  description:
                    "Todas as sessões serão encerradas e você precisará entrar novamente.",
                })
              }
            >
              Revogar outras sessões
            </Button>
          </CardHeader>
          <CardContent>
            <SecurityListState
              loading={sessions.isLoading}
              error={sessions.error}
              empty={!sessions.isLoading && !sessions.error && activeSessions.length === 0}
            />
            <ul className="space-y-3">
              {activeSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  onRevoke={(s) =>
                    setConfirm({
                      kind: "session",
                      id: s.id,
                      title: s.current ? "Encerrar sessão atual" : "Revogar sessão",
                      description: s.current
                        ? "Esta sessão será encerrada e você voltará ao login."
                        : "Esta sessão será encerrada.",
                    })
                  }
                />
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Dispositivos aprovados</CardTitle>
          </CardHeader>
          <CardContent>
            <SecurityListState
              loading={devices.isLoading}
              error={devices.error}
              empty={!devices.isLoading && !devices.error && approvedDevices.length === 0}
            />
            <ul className="space-y-3">
              {approvedDevices.map((device) => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  onRevoke={(d) =>
                    setConfirm({
                      kind: "device",
                      id: d.id,
                      title: d.current ? "Revogar dispositivo atual" : "Revogar dispositivo",
                      description: d.current
                        ? "Este dispositivo precisará ser aprovado novamente e sua sessão pode ser encerrada."
                        : "Este dispositivo precisará ser aprovado novamente para criar novas sessões.",
                    })
                  }
                />
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" /> Alterar senha
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PasswordForm
              pending={mutations.changePassword.isPending}
              onSubmit={(payload) => mutations.changePassword.mutate(payload)}
            />
          </CardContent>
        </Card>
        <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
              <AlertDialogDescription>{confirm?.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
              <AlertDialogAction disabled={busy} onClick={confirmAction}>
                {busy ? "Enviando..." : "Confirmar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </AccountLayout>
    </AuthGate>
  );
}
