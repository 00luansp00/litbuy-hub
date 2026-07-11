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
import type { AdminOrder } from "@/types";

export const Route = createFileRoute("/admin/pedidos")({
  component: AdminOrdersPage,
});

const STATUS_OPTS = [
  { value: "all", label: "Status: todos" },
  { value: "awaiting_payment", label: "Aguard. pagamento" },
  { value: "paid", label: "Pago" },
  { value: "delivered", label: "Em entrega" },
  { value: "completed", label: "Concluído" },
  { value: "cancelled", label: "Cancelado" },
  { value: "in_dispute", label: "Em disputa" },
];

function currency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function date(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [risk, setRisk] = useState("all");

  useEffect(() => {
    let m = true;
    adminService.getAdminOrders().then((o) => m && setOrders(o));
    return () => {
      m = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!orders) return [];
    const q = search.trim().toLowerCase();
    return orders.filter(
      (o) =>
        (status === "all" || o.status === status) &&
        (risk === "all" || o.risk === risk) &&
        (!q ||
          o.code.toLowerCase().includes(q) ||
          o.buyerName.toLowerCase().includes(q) ||
          o.sellerName.toLowerCase().includes(q)),
    );
  }, [orders, search, status, risk]);

  return (
    <AdminLayout
      title="Pedidos"
      description="Monitoramento operacional de pedidos — visual/mockado."
    >
      <AdminFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por código, comprador ou vendedor..."
        status={status}
        onStatusChange={setStatus}
        statusOptions={STATUS_OPTS}
        risk={risk}
        onRiskChange={setRisk}
      />

      <div className="rounded-2xl border border-border bg-card shadow-card">
        {!orders ? (
          <div className="p-4">
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon="ShoppingBag" title="Nenhum pedido encontrado" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Comprador</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Risco</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.code}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{o.buyerName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{o.sellerName}</TableCell>
                    <TableCell className="max-w-[220px] truncate text-xs">{o.productTitle}</TableCell>
                    <TableCell className="text-right">{currency(o.amount)}</TableCell>
                    <TableCell>
                      <AdminStatusBadge status={o.status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{o.paymentMethod}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{date(o.createdAt)}</TableCell>
                    <TableCell>
                      <AdminRiskBadge risk={o.risk} />
                    </TableCell>
                    <TableCell>
                      <AdminActionMenu
                        actions={[
                          { label: "Ver detalhes" },
                          { label: "Marcar para análise" },
                          { label: "Abrir disputa" },
                          { label: "Contatar partes" },
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
