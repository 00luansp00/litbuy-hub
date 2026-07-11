import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminDashboardSection } from "@/components/admin/AdminDashboardSection";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminAdvancedService } from "@/services/adminAdvancedService";
import type { AdminReportMetric, AdminReportRow } from "@/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/relatorios")({
  component: AdminReportsPage,
});

function AdminReportsPage() {
  const [metrics, setMetrics] = useState<AdminReportMetric[]>([]);
  const [cats, setCats] = useState<AdminReportRow[]>([]);
  const [sellers, setSellers] = useState<AdminReportRow[]>([]);

  useEffect(() => {
    adminAdvancedService.getReportMetrics().then(setMetrics);
    adminAdvancedService.getTopCategoriesReport().then(setCats);
    adminAdvancedService.getTopSellersReport().then(setSellers);
  }, []);

  return (
    <AdminLayout
      title="Relatórios"
      description="Métricas operacionais e comerciais — todos os dados são mockados."
    >
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {metrics.map((m) => {
          const Icon = m.deltaDirection === "up" ? ArrowUpRight : m.deltaDirection === "down" ? ArrowDownRight : Minus;
          const tone = m.deltaDirection === "up" ? "text-success" : m.deltaDirection === "down" ? "text-destructive" : "text-muted-foreground";
          return (
            <div key={m.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="text-[11px] uppercase text-muted-foreground">{m.label}</div>
              <div className="mt-1 text-lg font-semibold text-foreground">{m.value}</div>
              <div className={cn("mt-1 flex items-center gap-1 text-xs", tone)}>
                <Icon className="h-3 w-3" /> {m.delta}
              </div>
            </div>
          );
        })}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <AdminDashboardSection title="Categorias mais vendidas" description="Share do GMV — 30d.">
          <div className="space-y-3">
            {cats.map((c) => (
              <div key={c.id}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-foreground">{c.label}</span>
                  <span className="text-muted-foreground">{c.value} · {c.share}%</span>
                </div>
                <Progress value={c.share ?? 0} className="h-2" />
              </div>
            ))}
          </div>
        </AdminDashboardSection>

        <AdminDashboardSection title="Vendedores com maior volume">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-right">Volume 30d</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sellers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.label}</TableCell>
                  <TableCell className="text-right font-medium">{s.value}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AdminDashboardSection>
      </div>

      <AdminDashboardSection title="Outros relatórios" description="Módulos previstos para a versão com backend.">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 text-xs text-muted-foreground">
          {[
            "Anúncios com mais conversão",
            "Produtos com mais denúncias",
            "Disputas abertas por categoria",
            "Usuários novos por origem",
            "Pedidos cancelados por motivo",
            "Saques pendentes por vendedor",
            "Uso de LIT Points",
            "Adesão ao LIT-MAX",
            "Uso da Proteção LIT",
            "Afiliados (futuro)",
          ].map((r) => (
            <div key={r} className="rounded-xl border border-dashed border-border bg-surface/30 p-3">
              {r}
            </div>
          ))}
        </div>
      </AdminDashboardSection>
    </AdminLayout>
  );
}
