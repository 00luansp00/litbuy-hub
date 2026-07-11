import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, Star } from "lucide-react";
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
import type { AdminSeller } from "@/types";

export const Route = createFileRoute("/admin/vendedores")({
  component: AdminSellersPage,
});

const STATUS_OPTS = [
  { value: "all", label: "Status: todos" },
  { value: "approved", label: "Aprovado" },
  { value: "active", label: "Ativo" },
  { value: "in_review", label: "Em análise" },
  { value: "suspended", label: "Suspenso" },
];

function currency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function AdminSellersPage() {
  const [sellers, setSellers] = useState<AdminSeller[] | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [risk, setRisk] = useState("all");

  useEffect(() => {
    let m = true;
    adminService.getAdminSellers().then((s) => m && setSellers(s));
    return () => {
      m = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!sellers) return [];
    const q = search.trim().toLowerCase();
    return sellers.filter(
      (s) =>
        (status === "all" || s.status === status) &&
        (risk === "all" || s.risk === risk) &&
        (!q || s.storeName.toLowerCase().includes(q)),
    );
  }, [sellers, search, status, risk]);

  return (
    <AdminLayout
      title="Vendedores"
      description="Aprovação, verificação e monitoramento de vendedores — visual/mockado."
    >
      <AdminFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por loja..."
        status={status}
        onStatusChange={setStatus}
        statusOptions={STATUS_OPTS}
        risk={risk}
        onRiskChange={setRisk}
      />

      <div className="rounded-2xl border border-border bg-card shadow-card">
        {!sellers ? (
          <div className="p-4">
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon="Store" title="Nenhum vendedor encontrado" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loja</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Anúncios</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead>Avaliação</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead>Risco</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border border-border">
                          <AvatarImage src={s.avatarUrl} alt={s.storeName} />
                          <AvatarFallback>{s.storeName.slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="flex items-center gap-1 truncate text-sm font-medium text-foreground">
                            {s.storeName}
                            {s.verified && (
                              <BadgeCheck className="h-3.5 w-3.5 text-success" aria-label="Verificado" />
                            )}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{s.ownerName}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <AdminStatusBadge status={s.status} />
                    </TableCell>
                    <TableCell className="text-right">{s.activeListings}</TableCell>
                    <TableCell className="text-right">{s.sales}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-sm">
                        <Star className="h-3.5 w-3.5 fill-warning text-warning" /> {s.rating.toFixed(1)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{currency(s.volume)}</TableCell>
                    <TableCell>
                      <AdminRiskBadge risk={s.risk} />
                    </TableCell>
                    <TableCell>
                      <AdminActionMenu
                        actions={[
                          { label: "Ver loja pública" },
                          { label: "Aprovar vendedor" },
                          { label: "Verificar documentos" },
                          { label: "Enviar aviso" },
                          { label: "Suspender vendedor", destructive: true },
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
