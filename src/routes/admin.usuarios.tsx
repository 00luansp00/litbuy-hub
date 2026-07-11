import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { AdminRiskBadge } from "@/components/admin/AdminRiskBadge";
import { AdminActionMenu } from "@/components/admin/AdminActionMenu";
import { AdminFilters } from "@/components/admin/AdminFilters";
import { EmptyState } from "@/components/common/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminService } from "@/services/adminService";
import type { AdminUser } from "@/types";

export const Route = createFileRoute("/admin/usuarios")({
  component: AdminUsersPage,
});

function currency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function date(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

const STATUS_OPTS = [
  { value: "all", label: "Status: todos" },
  { value: "active", label: "Ativo" },
  { value: "in_review", label: "Em análise" },
  { value: "suspended", label: "Suspenso" },
  { value: "blocked", label: "Bloqueado" },
];

function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [risk, setRisk] = useState("all");

  useEffect(() => {
    let m = true;
    adminService.getAdminUsers().then((u) => m && setUsers(u));
    return () => {
      m = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!users) return [];
    const q = search.trim().toLowerCase();
    return users.filter(
      (u) =>
        (status === "all" || u.status === status) &&
        (risk === "all" || u.risk === risk) &&
        (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)),
    );
  }, [users, search, status, risk]);

  return (
    <AdminLayout
      title="Usuários"
      description="Gerencie visualmente os usuários da plataforma. Ações não persistem."
    >
      <AdminFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por nome ou e-mail..."
        status={status}
        onStatusChange={setStatus}
        statusOptions={STATUS_OPTS}
        risk={risk}
        onRiskChange={setRisk}
      />

      <div className="rounded-2xl border border-border bg-card shadow-card">
        {!users ? (
          <div className="p-4">
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon="Users" title="Nenhum usuário encontrado" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead className="text-right">Pedidos</TableHead>
                  <TableHead className="text-right">Gasto</TableHead>
                  <TableHead>Risco</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border border-border">
                          <AvatarImage src={u.avatarUrl} alt={u.name} />
                          <AvatarFallback>{u.name.slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{u.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <AdminStatusBadge status={u.status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {u.kind === "buyer_seller" ? "Comprador + Vendedor" : u.kind === "seller" ? "Vendedor" : u.kind === "staff" ? "Equipe" : "Comprador"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{date(u.createdAt)}</TableCell>
                    <TableCell className="text-right">{u.orders}</TableCell>
                    <TableCell className="text-right">{currency(u.totalSpent)}</TableCell>
                    <TableCell>
                      <AdminRiskBadge risk={u.risk} />
                    </TableCell>
                    <TableCell>
                      <AdminActionMenu
                        actions={[
                          { label: "Visualizar" },
                          { label: "Enviar aviso" },
                          { label: "Suspender", destructive: true },
                          { label: "Reativar" },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
