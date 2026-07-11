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
import type { AdminListing } from "@/types";

export const Route = createFileRoute("/admin/anuncios")({
  component: AdminListingsPage,
});

const STATUS_OPTS = [
  { value: "all", label: "Status: todos" },
  { value: "active", label: "Ativo" },
  { value: "paused", label: "Pausado" },
  { value: "in_review", label: "Em análise" },
  { value: "rejected", label: "Recusado" },
  { value: "removed", label: "Removido" },
];

function currency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function AdminListingsPage() {
  const [items, setItems] = useState<AdminListing[] | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [risk, setRisk] = useState("all");

  useEffect(() => {
    let m = true;
    adminService.getAdminListings().then((l) => m && setItems(l));
    return () => {
      m = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = search.trim().toLowerCase();
    return items.filter(
      (l) =>
        (status === "all" || l.status === status) &&
        (risk === "all" || l.risk === risk) &&
        (!q || l.title.toLowerCase().includes(q) || l.sellerName.toLowerCase().includes(q)),
    );
  }, [items, search, status, risk]);

  return (
    <AdminLayout
      title="Anúncios"
      description="Moderação visual de anúncios da plataforma."
    >
      <AdminFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por título ou vendedor..."
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
          <EmptyState icon="Package" title="Nenhum anúncio encontrado" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Anúncio</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead className="text-right">Estoque</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead className="text-right">Denúncias</TableHead>
                  <TableHead>Risco</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <img
                          src={l.image}
                          alt=""
                          className="h-10 w-10 rounded-md object-cover"
                          loading="lazy"
                        />
                        <p className="max-w-[240px] truncate text-sm font-medium text-foreground">
                          {l.title}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{l.sellerName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{l.categoryName}</TableCell>
                    <TableCell className="text-right">{currency(l.price)}</TableCell>
                    <TableCell className="text-right">{l.stock}</TableCell>
                    <TableCell>
                      <AdminStatusBadge status={l.status} />
                    </TableCell>
                    <TableCell className="text-right">{l.sales}</TableCell>
                    <TableCell className="text-right">
                      {l.reports > 0 ? (
                        <span className="font-semibold text-destructive">{l.reports}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <AdminRiskBadge risk={l.risk} />
                    </TableCell>
                    <TableCell>
                      <AdminActionMenu
                        actions={[
                          { label: "Ver produto" },
                          { label: "Aprovar" },
                          { label: "Destacar" },
                          { label: "Pausar" },
                          { label: "Remover", destructive: true },
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
