import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ExternalLink, MessageSquare, Package, Receipt, ShieldAlert } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ReportSeverityBadge } from "@/components/report/ReportSeverityBadge";
import { ReportStatusBadge } from "@/components/report/ReportStatusBadge";
import { reportService } from "@/services/reportService";
import { analyticsService } from "@/services/analyticsService";
import type { Report, ReportTargetType } from "@/types";

export const Route = createFileRoute("/admin/denuncias")({
  component: AdminReportsPage,
});

const STATUS_OPTS = [
  { value: "all", label: "Status: todas" },
  { value: "submitted", label: "Enviada" },
  { value: "under_review", label: "Em análise" },
  { value: "action_required", label: "Ação necessária" },
  { value: "resolved", label: "Resolvida" },
  { value: "rejected", label: "Rejeitada" },
  { value: "closed", label: "Encerrada" },
];

const TARGET_LABEL: Record<ReportTargetType, string> = {
  product: "Anúncio",
  seller: "Vendedor",
  message: "Mensagem",
  conversation: "Conversa",
  order: "Pedido",
  sale: "Venda",
  user: "Usuário",
  payment: "Pagamento",
  other: "Outro",
};

const SOURCE_LABEL: Record<string, string> = {
  product_page: "Página do anúncio",
  seller_page: "Loja do vendedor",
  message_thread: "Conversa",
  order_page: "Pedido",
  sale_page: "Venda (vendedor)",
  chat_order: "Chat do pedido",
  admin: "Admin",
  other: "Outro",
};

function date(iso: string) {
  return new Date(iso).toLocaleString("pt-BR");
}

function AdminReportsPage() {
  const [items, setItems] = useState<Report[] | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [risk, setRisk] = useState("all");
  const [selected, setSelected] = useState<Report | null>(null);

  const reload = () => {
    void reportService.getReportsForAdmin().then((r) => setItems(r));
  };

  useEffect(() => {
    reload();
  }, []);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = search.trim().toLowerCase();
    return items.filter(
      (r) =>
        (status === "all" || r.status === status) &&
        (risk === "all" || r.severity === risk) &&
        (!q ||
          r.targetLabel.toLowerCase().includes(q) ||
          r.reporterName.toLowerCase().includes(q) ||
          r.code.toLowerCase().includes(q)),
    );
  }, [items, search, status, risk]);

  const openDetail = (r: Report) => {
    setSelected(r);
    analyticsService.track("admin_report_review_opened_mocked", {
      reportId: r.id,
      severity: r.severity,
    });
  };

  const runAction = (r: Report, action: string) => {
    analyticsService.track("admin_report_action_mocked", {
      reportId: r.id,
      action,
    });
    toast.success(`Ação "${action}" executada (mock)`, {
      description: "Nenhuma alteração real foi feita. Backend necessário.",
    });
  };

  return (
    <AdminLayout
      title="Denúncias"
      description="Denúncias enviadas por usuários. Visual/mockado — nenhuma ação real é executada."
    >
      <AdminFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por alvo, denunciante ou código..."
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
                  <TableHead>Código</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Alvo</TableHead>
                  <TableHead>Denunciante</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Severidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Atualizada</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {r.code}
                    </TableCell>
                    <TableCell className="text-xs">
                      {TARGET_LABEL[r.targetType]}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-sm font-medium">
                      {r.targetLabel}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.reporterName}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.reasonLabel}
                    </TableCell>
                    <TableCell>
                      <ReportSeverityBadge severity={r.severity} />
                    </TableCell>
                    <TableCell>
                      <ReportStatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {SOURCE_LABEL[r.source] ?? r.source}
                    </TableCell>
                    <TableCell className="text-[11px] text-muted-foreground">
                      {date(r.updatedAt)}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openDetail(r)}
                      >
                        Detalhes
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Sheet
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-primary" />
                  Denúncia {selected.code}
                </SheetTitle>
                <SheetDescription>
                  Detalhe visual da denúncia. Ações são mockadas.
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {TARGET_LABEL[selected.targetType]}
                  </Badge>
                  <ReportSeverityBadge severity={selected.severity} />
                  <ReportStatusBadge status={selected.status} />
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Alvo</div>
                  <div className="font-medium text-foreground">
                    {selected.targetLabel}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Motivo</div>
                  <div className="text-foreground">{selected.reasonLabel}</div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Descrição</div>
                  <p className="whitespace-pre-wrap text-foreground">
                    {selected.description || "—"}
                  </p>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <Info label="Denunciante">{selected.reporterName}</Info>
                  <Info label="Denunciado">
                    {selected.reportedUserName ?? "—"}
                  </Info>
                  <Info label="Origem">
                    {SOURCE_LABEL[selected.source] ?? selected.source}
                  </Info>
                  <Info label="Responsável">
                    {selected.assignedTo ?? "Não atribuído"}
                  </Info>
                  <Info label="Criada em">{date(selected.createdAt)}</Info>
                  <Info label="Atualizada em">{date(selected.updatedAt)}</Info>
                </div>

                {selected.context && (
                  <>
                    <Separator />
                    <div>
                      <div className="mb-2 text-xs font-medium text-muted-foreground">
                        Contexto
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selected.context.orderId && (
                          <Button asChild size="sm" variant="outline">
                            <Link
                              to="/pedidos/$id"
                              params={{ id: selected.context.orderId }}
                            >
                              <Receipt className="h-3.5 w-3.5" /> Ver pedido
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </Button>
                        )}
                        {selected.context.conversationId && (
                          <Button asChild size="sm" variant="outline">
                            <Link
                              to="/mensagens/$id"
                              params={{ id: selected.context.conversationId }}
                            >
                              <MessageSquare className="h-3.5 w-3.5" /> Ver
                              conversa
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </Button>
                        )}
                        {selected.context.productId && (
                          <Button asChild size="sm" variant="outline">
                            <Link
                              to="/produto/$id"
                              params={{ id: selected.context.productId }}
                            >
                              <Package className="h-3.5 w-3.5" /> Ver anúncio
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </Button>
                        )}
                        {selected.context.sellerSlug && (
                          <Button asChild size="sm" variant="outline">
                            <Link
                              to="/loja/$slug"
                              params={{ slug: selected.context.sellerSlug }}
                            >
                              <ExternalLink className="h-3 w-3" /> Ver loja
                            </Link>
                          </Button>
                        )}
                        <Button asChild size="sm" variant="ghost">
                          <Link to="/admin/disputas">
                            Abrir mediação relacionada
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                <div>
                  <div className="mb-2 text-xs font-medium text-muted-foreground">
                    Evidências ({selected.evidence.length})
                  </div>
                  {selected.evidence.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Nenhuma evidência anexada.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {selected.evidence.map((e) => (
                        <li
                          key={e.id}
                          className="rounded-lg border border-border bg-surface/40 p-2 text-xs"
                        >
                          <span className="text-muted-foreground">
                            [{e.kind}]{" "}
                          </span>
                          {e.label}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {selected.internalNotes &&
                  selected.internalNotes.length > 0 && (
                    <div>
                      <div className="mb-2 text-xs font-medium text-muted-foreground">
                        Notas internas
                      </div>
                      <ul className="space-y-1 text-xs text-foreground">
                        {selected.internalNotes.map((n, i) => (
                          <li key={i}>• {n}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                {selected.resolution && (
                  <div className="rounded-xl border border-success/30 bg-success/5 p-3 text-xs">
                    <div className="font-medium text-success">
                      Ação tomada: {selected.resolution.action}
                    </div>
                    {selected.resolution.note && (
                      <p className="mt-1 text-foreground">
                        {selected.resolution.note}
                      </p>
                    )}
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      por {selected.resolution.actor ?? "Moderação"} em{" "}
                      {date(selected.resolution.at)}
                    </p>
                  </div>
                )}

                <Separator />

                <div>
                  <div className="mb-2 text-xs font-medium text-muted-foreground">
                    Ações (mock)
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => runAction(selected, "assumir_analise")}
                    >
                      Assumir análise
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => runAction(selected, "em_revisao")}
                    >
                      Marcar em revisão
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        runAction(selected, "solicitar_mais_infos")
                      }
                    >
                      Solicitar mais informações
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => runAction(selected, "resolver_sem_acao")}
                    >
                      Resolver sem ação
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => runAction(selected, "aplicar_alerta")}
                    >
                      Aplicar alerta
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        runAction(selected, "encaminhar_mediacao")
                      }
                    >
                      Encaminhar para mediação
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => runAction(selected, "suspender_anuncio")}
                    >
                      Suspender anúncio
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => runAction(selected, "bloquear_usuario")}
                    >
                      Bloquear usuário
                    </Button>
                  </div>
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    Ações reais exigirão RBAC, audit log e backend seguro.
                  </p>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AdminLayout>
  );
}

function Info({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-foreground">{children}</div>
    </div>
  );
}
