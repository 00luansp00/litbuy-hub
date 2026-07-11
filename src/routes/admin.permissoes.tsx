import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Check, Lock, Plus, ShieldCheck } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminDashboardSection } from "@/components/admin/AdminDashboardSection";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { adminAdvancedService } from "@/services/adminAdvancedService";
import type { AdminPermissionDef, AdminRoleDef } from "@/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/permissoes")({
  component: AdminPermissoesPage,
});

function AdminPermissoesPage() {
  const [perms, setPerms] = useState<AdminPermissionDef[]>([]);
  const [roles, setRoles] = useState<AdminRoleDef[]>([]);

  useEffect(() => {
    adminAdvancedService.getPermissions().then(setPerms);
    adminAdvancedService.getRoles().then(setRoles);
  }, []);

  const toggleRole = (id: string) => {
    setRoles((prev) => prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r)));
    toast("Perfil alternado (mock)");
  };

  return (
    <AdminLayout
      title="Permissões e perfis"
      description="Matriz visual de perfis e permissões — não aplica RBAC real."
      actions={
        <Button size="sm" onClick={() => toast("Criar perfil (mock)")}>
          <Plus className="mr-2 h-4 w-4" /> Novo perfil
        </Button>
      }
    >
      <AdminDashboardSection title="Perfis" description="Ative, edite e atribua a moderadores.">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {roles.map((r) => (
            <article key={r.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-foreground">{r.name}</h4>
                    {!r.active && <Badge variant="outline">Inativo</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>
                </div>
                <Switch checked={r.active} onCheckedChange={() => toggleRole(r.id)} />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{r.members} membro(s)</span>
                <span>{r.permissions.length} permissões</span>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => toast("Editar perfil (mock)")}>Editar</Button>
                <Button size="sm" variant="ghost" onClick={() => toast("Atribuir a usuário (mock)")}>Atribuir</Button>
              </div>
            </article>
          ))}
        </div>
      </AdminDashboardSection>

      <AdminDashboardSection title="Matriz de permissões" description="Visão consolidada — check/lock só visual.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-2 pr-4">Permissão</th>
                {roles.map((r) => (
                  <th key={r.id} className="px-2 py-2 text-center font-medium whitespace-nowrap">{r.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {perms.map((p) => (
                <tr key={p.key} className="border-t border-border">
                  <td className="py-2 pr-4">
                    <TooltipProvider delayDuration={150}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={cn("cursor-help text-sm font-medium", p.sensitive ? "text-warning" : "text-foreground")}>
                            {p.label}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>Grupo: {p.group}{p.sensitive ? " · sensível" : ""}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </td>
                  {roles.map((r) => {
                    const allowed = r.permissions.includes(p.key);
                    return (
                      <td key={r.id} className="px-2 py-2 text-center">
                        {allowed ? (
                          <Check className="mx-auto h-4 w-4 text-success" />
                        ) : (
                          <Lock className="mx-auto h-4 w-4 text-muted-foreground/40" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground flex items-center gap-1">
          <ShieldCheck className="h-3 w-3" /> Nesta fase, o AdminGate protege apenas visualmente. RBAC real deve ser aplicado no backend.
        </p>
      </AdminDashboardSection>
    </AdminLayout>
  );
}
