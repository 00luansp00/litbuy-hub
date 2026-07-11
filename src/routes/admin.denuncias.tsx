import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { AdminRiskBadge } from "@/components/admin/AdminRiskBadge";
import { AdminActionMenu } from "@/components/admin/AdminActionMenu";
import { AdminFilters } from "@/components/admin/AdminFilters";
import { EmptyState } from "@/components/common/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminService } from "@/services/adminService";
import type { AdminReport, AdminReportTargetKind } from "@/types";

export const Route = createFileRoute("/admin/denuncias")({
  component: AdminReportsPage,
});

const STATUS_OPTS = [
  { value: "all", label: "Status: todas" },
  { value: "open", label: "Aberta" },
  { value: "in_review", label: "Em análise" },
  { value: "resolved", label: "Resolvida" },
  { value: "closed", label: "Encerrada" },
];

const TARGET_LABEL: Record<AdminReportTargetKind, string> = {
  listing: "Anúncio",
  seller: "Vendedor",
  user: "Usuário",
  message: "Mensagem",
  order: "Pedido",
};

function date(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function AdminReportsPage() {
  const [items, setItems] = useState<AdminReport[] | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [risk, setRisk] = useState("all");

  useEffect(() => {
    let m = true;
    adminService.getAdminReports().then((r) => m && setItems(r));
    return () => {
      m = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = search.trim().toLowerCase();
    return items.filter(
      (r) =>
        (status === "all" || r.status === status) &&
        (risk === "all" || r.priority === risk) &&
        (!q || r.targetLabel.toLowerCase().includes(q) || r.reporterName.toLowerCase().includes(q)),
    );
  }, [items, search, status, risk]);

  return (
    <AdminLayout
      title="Denúncias"
      description="Denúncias enviadas por usuários — visual/mockado."
    >
      <AdminFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por alvo ou denunciante..."
        status={status}
        onStatusChange={setStatus}
        statusOptions={STATUS_OPTS}
        risk={risk}
        onRiskChange={setRisk}
      />

      <div className="rounded-2xl border border-border bg-card shadow-card">
        {!items ? (
          <div className="p-4">
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon="Flag" title="Nenhuma denúncia encontrada" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Alvo</TableHead>
                  <TableHead>Denunciante</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{TARGET_LABEL[r.targetKind]}</TableCell>
                    <TableCell className="max-w-[220px] truncate text-sm font-medium">
                      {r.targetLabel}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.reporterName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.reason}</TableCell>
                    <TableCell>
                      <AdminRiskBadge risk={r.priority} />
                    </TableCell>
                    <TableCell>
                      <AdminStatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{date(r.createdAt)}</TableCell>
                    <TableCell>
                      <AdminActionMenu
                        actions={[
                          { label: "Revisar" },
                          { label: "Ignorar" },
                          { label: "Remover conteúdo", destructive: true },
                          { label: "Suspender conta", destructive: true },
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
