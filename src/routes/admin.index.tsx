import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminMetricCard } from "@/components/admin/AdminMetricCard";
import { AdminDashboardSection } from "@/components/admin/AdminDashboardSection";
import { AdminActivityFeed } from "@/components/admin/AdminActivityFeed";
import { AdminAlertCard } from "@/components/admin/AdminAlertCard";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { AdminRiskBadge } from "@/components/admin/AdminRiskBadge";
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
import { BarChart3, ClipboardList, FileText, Flag, Gavel, Layers, Package, ShieldCheck, Wallet } from "lucide-react";
import { adminService } from "@/services/adminService";
import type { AdminDashboardSummary } from "@/types";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboardPage,
});

function currency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboardSummary | null>(null);

  useEffect(() => {
    let mounted = true;
    adminService.getAdminDashboard().then((d) => {
      if (mounted) setData(d);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <AdminLayout
      title="Visão geral"
      description="Métricas operacionais mockadas — dados fictícios de demonstração."
    >
      {/* Métricas */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {data
          ? data.metrics.map((m, i) => <AdminMetricCard key={m.id} metric={m} index={i} />)
          : Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-[110px] rounded-2xl" />
            ))}
      </div>

      {/* Ações rápidas */}
      <AdminDashboardSection title="Ações rápidas" description="Atalhos para as áreas mais usadas.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { to: "/admin/anuncios", icon: Package, label: "Revisar anúncios" },
            { to: "/admin/denuncias", icon: Flag, label: "Revisar denúncias" },
            { to: "/admin/disputas", icon: Gavel, label: "Revisar disputas" },
            { to: "/admin/verificacoes", icon: ShieldCheck, label: "Revisar KYC" },
            { to: "/admin/relatorios", icon: BarChart3, label: "Ver relatórios" },
            { to: "/admin/financeiro", icon: Wallet, label: "Financeiro" },
            { to: "/admin/catalogo", icon: Layers, label: "Catálogo" },
            { to: "/admin/conteudo", icon: FileText, label: "Conteúdo" },
            { to: "/admin/auditoria", icon: ClipboardList, label: "Auditoria" },
          ].map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.to}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                to={a.to as any}
                className="group flex items-center gap-2 rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground"
              >
                <Icon className="h-4 w-4 text-primary" />
                <span className="truncate">{a.label}</span>
              </Link>
            );
          })}
        </div>
      </AdminDashboardSection>

      {/* Alertas críticos */}
      <AdminDashboardSection
        title="Alertas críticos"
        description="Ações prioritárias que exigem atenção da equipe."
      >
        {data ? (
          data.alerts.length ? (
            <div className="grid gap-3 md:grid-cols-3">
              {data.alerts.map((a) => (
                <AdminAlertCard key={a.id} alert={a} />
              ))}
            </div>
          ) : (
            <EmptyState icon="ShieldCheck" title="Nenhum alerta crítico" />
          )
        ) : (
          <Skeleton className="h-[110px] rounded-xl" />
        )}
      </AdminDashboardSection>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <AdminDashboardSection
          title="Pedidos recentes"
          description="Últimos pedidos registrados na plataforma."
        >
          {data ? (
            data.recentOrders.length ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Comprador</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Risco</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recentOrders.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-medium">{o.code}</TableCell>
                        <TableCell className="text-muted-foreground">{o.buyerName}</TableCell>
                        <TableCell className="text-muted-foreground">{o.sellerName}</TableCell>
                        <TableCell className="text-right">{currency(o.amount)}</TableCell>
                        <TableCell>
                          <AdminStatusBadge status={o.status} />
                        </TableCell>
                        <TableCell>
                          <AdminRiskBadge risk={o.risk} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyState icon="ShoppingBag" title="Nenhum pedido recente" />
            )
          ) : (
            <Skeleton className="h-64 rounded-xl" />
          )}
        </AdminDashboardSection>

        <AdminDashboardSection
          title="Atividade recente"
          description="Eventos operacionais das últimas horas."
        >
          {data ? (
            <AdminActivityFeed entries={data.activity} />
          ) : (
            <Skeleton className="h-64 rounded-xl" />
          )}
        </AdminDashboardSection>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <AdminDashboardSection title="Anúncios em análise">
          {data && data.pendingListings.length ? (
            <ul className="space-y-3">
              {data.pendingListings.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center gap-3 rounded-lg border border-border/60 p-2"
                >
                  <img
                    src={l.image}
                    alt=""
                    className="h-10 w-10 rounded-md object-cover"
                    loading="lazy"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{l.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {l.sellerName} · {l.categoryName}
                    </p>
                  </div>
                  <AdminStatusBadge status={l.status} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="Package" title="Nenhum anúncio em análise" />
          )}
        </AdminDashboardSection>

        <AdminDashboardSection title="Disputas abertas">
          {data && data.openDisputes.length ? (
            <ul className="space-y-3">
              {data.openDisputes.map((d) => (
                <li key={d.id} className="rounded-lg border border-border/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{d.orderCode}</p>
                    <AdminRiskBadge risk={d.priority} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{d.reason}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-muted-foreground">
                      {d.buyerName} × {d.sellerName}
                    </span>
                    <AdminStatusBadge status={d.status} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="Gavel" title="Nenhuma disputa aberta" />
          )}
        </AdminDashboardSection>

        <AdminDashboardSection title="Vendedores em destaque">
          {data && data.topSellers.length ? (
            <ul className="space-y-3">
              {data.topSellers.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-3 rounded-lg border border-border/60 p-2"
                >
                  <img
                    src={s.avatarUrl}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover"
                    loading="lazy"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{s.storeName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {s.sales} vendas · ★ {s.rating.toFixed(1)}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-xs font-semibold text-foreground">
                    {currency(s.volume)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="Store" title="Nenhum vendedor em destaque" />
          )}
        </AdminDashboardSection>
      </div>
    </AdminLayout>
  );
}
