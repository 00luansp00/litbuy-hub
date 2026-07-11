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
import type { AdminDispute } from "@/types";

export const Route = createFileRoute("/admin/disputas")({
  component: AdminDisputesPage,
});

const STATUS_OPTS = [
  { value: "all", label: "Status: todas" },
  { value: "open", label: "Aberta" },
  { value: "awaiting_buyer", label: "Aguard. comprador" },
  { value: "awaiting_seller", label: "Aguard. vendedor" },
  { value: "in_review", label: "Em análise" },
  { value: "resolved", label: "Resolvida" },
  { value: "closed", label: "Encerrada" },
];

function date(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function AdminDisputesPage() {
  const [items, setItems] = useState<AdminDispute[] | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [risk, setRisk] = useState("all");

  useEffect(() => {
    let m = true;
    adminService.getAdminDisputes().then((d) => m && setItems(d));
    return () => {
      m = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = search.trim().toLowerCase();
    return items.filter(
      (d) =>
        (status === "all" || d.status === status) &&
        (risk === "all" || d.priority === risk) &&
        (!q ||
          d.orderCode.toLowerCase().includes(q) ||
          d.buyerName.toLowerCase().includes(q) ||
          d.sellerName.toLowerCase().includes(q)),
    );
  }, [items, search, status, risk]);

  return (
    <AdminLayout
      title="Disputas"
      description="Mediações e resoluções de disputas — visual/mockado."
    >
      <AdminFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por pedido ou parte..."
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
          <EmptyState icon="Gavel" title="Nenhuma disputa encontrada" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Comprador</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Aberta</TableHead>
                  <TableHead>Atualizada</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.orderCode}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{d.buyerName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{d.sellerName}</TableCell>
                    <TableCell className="max-w-[220px] truncate text-xs">{d.reason}</TableCell>
                    <TableCell>
                      <AdminStatusBadge status={d.status} />
                    </TableCell>
                    <TableCell>
                      <AdminRiskBadge risk={d.priority} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{date(d.openedAt)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{date(d.updatedAt)}</TableCell>
                    <TableCell>
                      <AdminActionMenu
                        actions={[
                          { label: "Ver conversa" },
                          { label: "Solicitar evidência" },
                          { label: "Resolver a favor do comprador" },
                          { label: "Resolver a favor do vendedor" },
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
