import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { AdminRiskBadge } from "@/components/admin/AdminRiskBadge";
import { AdminFilters } from "@/components/admin/AdminFilters";
import { EmptyState } from "@/components/common/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminService } from "@/services/adminService";
import type { AdminTransaction, AdminTransactionKind } from "@/types";

export const Route = createFileRoute("/admin/transacoes")({
  component: AdminTransactionsPage,
});

const STATUS_OPTS = [
  { value: "all", label: "Status: todos" },
  { value: "pending", label: "Pendente" },
  { value: "approved", label: "Aprovado" },
  { value: "rejected", label: "Recusado" },
  { value: "refunded", label: "Estornado" },
  { value: "in_review", label: "Em análise" },
];

const KIND_LABEL: Record<AdminTransactionKind, string> = {
  payment: "Pagamento",
  withdraw: "Saque",
  refund: "Estorno",
  fee: "Taxa",
  balance_release: "Liberação de saldo",
};

function currency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function date(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function AdminTransactionsPage() {
  const [txs, setTxs] = useState<AdminTransaction[] | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [risk, setRisk] = useState("all");

  useEffect(() => {
    let m = true;
    adminService.getAdminTransactions().then((t) => m && setTxs(t));
    return () => {
      m = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!txs) return [];
    const q = search.trim().toLowerCase();
    return txs.filter(
      (t) =>
        (status === "all" || t.status === status) &&
        (risk === "all" || t.risk === risk) &&
        (!q || t.reference.toLowerCase().includes(q) || t.userName.toLowerCase().includes(q)),
    );
  }, [txs, search, status, risk]);

  return (
    <AdminLayout
      title="Transações"
      description="Monitoramento visual de transações — nenhum valor real."
      actions={
        <Badge variant="outline" className="gap-1 border-warning/40 text-[10px] text-warning">
          Dados mockados
        </Badge>
      }
    >
      <AdminFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por referência ou usuário..."
        status={status}
        onStatusChange={setStatus}
        statusOptions={STATUS_OPTS}
        risk={risk}
        onRiskChange={setRisk}
      />

      <div className="rounded-2xl border border-border bg-card shadow-card">
        {!txs ? (
          <div className="p-4">
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon="Receipt" title="Nenhuma transação encontrada" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referência</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Risco</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{t.reference}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{t.userName}</TableCell>
                    <TableCell className="text-xs">{KIND_LABEL[t.kind]}</TableCell>
                    <TableCell
                      className={
                        "text-right font-semibold " +
                        (t.amount < 0 ? "text-destructive" : "text-success")
                      }
                    >
                      {currency(t.amount)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{t.method}</TableCell>
                    <TableCell>
                      <AdminStatusBadge status={t.status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{date(t.createdAt)}</TableCell>
                    <TableCell>
                      <AdminRiskBadge risk={t.risk} />
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
