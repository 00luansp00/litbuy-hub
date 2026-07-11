import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth/AuthGate";
import { SellerDashboardLayout } from "@/components/seller-dashboard/SellerDashboardLayout";
import { SellerTeamOverview } from "@/components/seller-dashboard/team/SellerTeamOverview";
import { SellerTeamMembersList } from "@/components/seller-dashboard/team/SellerTeamMembersList";
import { SellerTeamRolesCards } from "@/components/seller-dashboard/team/SellerTeamRolesCards";
import { SellerTeamPermissionsMatrix } from "@/components/seller-dashboard/team/SellerTeamPermissionsMatrix";
import { SellerTeamActivity } from "@/components/seller-dashboard/team/SellerTeamActivity";
import { SellerTeamInviteDialog } from "@/components/seller-dashboard/team/SellerTeamInviteDialog";
import { SellerTeamSecurityNotice } from "@/components/seller-dashboard/team/SellerTeamSecurityNotice";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { sellerTeamService } from "@/services/sellerTeamService";
import type {
  SellerTeamActivityEvent,
  SellerTeamInvite,
  SellerTeamMember,
  SellerTeamPermission,
  SellerTeamRole,
} from "@/types";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export const Route = createFileRoute("/vendedor/equipe")({
  component: EquipePage,
});

function EquipePage() {
  return (
    <AuthGate title="Entre para acessar sua equipe">
      <EquipeInner />
    </AuthGate>
  );
}

function EquipeInner() {
  const [members, setMembers] = useState<SellerTeamMember[]>([]);
  const [roles, setRoles] = useState<SellerTeamRole[]>([]);
  const [permissions, setPermissions] = useState<SellerTeamPermission[]>([]);
  const [invites, setInvites] = useState<SellerTeamInvite[]>([]);
  const [activity, setActivity] = useState<SellerTeamActivityEvent[]>([]);

  useEffect(() => {
    Promise.all([
      sellerTeamService.getTeamMembers(),
      sellerTeamService.getTeamRoles(),
      sellerTeamService.getTeamPermissions(),
      sellerTeamService.getPendingInvites(),
      sellerTeamService.getTeamActivity(),
    ]).then(([m, r, p, i, a]) => {
      setMembers(m);
      setRoles(r);
      setPermissions(p);
      setInvites(i);
      setActivity(a);
    });
  }, []);

  const roleById = new Map(roles.map((r) => [r.id, r] as const));

  const cancelInvite = async (id: string) => {
    await sellerTeamService.simulateCancelInvite(id);
    setInvites((prev) => prev.filter((x) => x.id !== id));
    toast("Convite cancelado (mock)");
  };

  return (
    <SellerDashboardLayout
      title="Equipe"
      description="Cargos, permissões e convites da sua loja — em modo demonstração."
      actions={<SellerTeamInviteDialog roles={roles} />}
    >
      <SellerTeamSecurityNotice />
      <SellerTeamOverview members={members} invites={invites} />

      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members">Membros</TabsTrigger>
          <TabsTrigger value="invites">Convites ({invites.length})</TabsTrigger>
          <TabsTrigger value="roles">Cargos</TabsTrigger>
          <TabsTrigger value="permissions">Permissões</TabsTrigger>
          <TabsTrigger value="activity">Atividade</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <SellerTeamMembersList members={members} roles={roles} />
          <p className="text-xs text-muted-foreground">
            Atendentes respondem mensagens · Operadores marcam entrega · Financeiro vê saldo · Dono
            controla permissões.
          </p>
        </TabsContent>

        <TabsContent value="invites">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h3 className="text-base font-semibold text-foreground">Convites pendentes</h3>
            {invites.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Nenhum convite pendente.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {invites.map((i) => (
                  <li key={i.id} className="flex items-center justify-between rounded-xl border border-border bg-surface/40 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{i.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {i.email} · {roleById.get(i.roleId)?.name ?? i.roleId}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Enviado {formatDistanceToNow(new Date(i.sentAt), { locale: ptBR, addSuffix: true })}
                      </p>
                    </div>
                    <button
                      onClick={() => cancelInvite(i.id)}
                      className="text-xs font-medium text-destructive hover:underline"
                    >
                      Cancelar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </TabsContent>

        <TabsContent value="roles">
          <SellerTeamRolesCards roles={roles} />
        </TabsContent>

        <TabsContent value="permissions">
          <SellerTeamPermissionsMatrix roles={roles} permissions={permissions} />
        </TabsContent>

        <TabsContent value="activity">
          <SellerTeamActivity events={activity} />
        </TabsContent>
      </Tabs>
    </SellerDashboardLayout>
  );
}
