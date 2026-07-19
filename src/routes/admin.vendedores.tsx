import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminFilters } from "@/components/admin/AdminFilters";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  sellerOnboardingService,
  type AdminSellerApplication,
} from "@/services/sellerOnboardingService";

export const Route = createFileRoute("/admin/vendedores")({ component: AdminSellersPage });
const statusOptions = [
  { value: "all", label: "Status: todos" },
  { value: "draft", label: "Rascunho" },
  { value: "submitted", label: "Enviado" },
  { value: "under_review", label: "Em análise" },
  { value: "approved", label: "Aprovado" },
  { value: "rejected", label: "Rejeitado" },
];
const rejectionCodes = [
  "INCOMPLETE_INFORMATION",
  "INVALID_STORE_NAME",
  "INVALID_STORE_SLUG",
  "PROHIBITED_ACTIVITY",
  "ACCOUNT_REQUIREMENTS_NOT_MET",
  "OTHER",
];
function label(s: string) {
  return statusOptions.find((o) => o.value === s)?.label ?? s;
}
function AdminSellersPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [rejecting, setRejecting] = useState<AdminSellerApplication | null>(null);
  const [code, setCode] = useState("INCOMPLETE_INFORMATION");
  const [reason, setReason] = useState("");
  const qc = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: ["admin", "seller-applications", status, search],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      sellerOnboardingService.adminList({
        status,
        search,
        limit: 20,
        cursor: pageParam ?? undefined,
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
  const items = useMemo(() => {
    const map = new Map<string, AdminSellerApplication>();
    for (const page of query.data?.pages ?? [])
      for (const item of page.items) map.set(item.id, item);
    return [...map.values()];
  }, [query.data?.pages]);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "seller-applications"] });
  const actionPending = (id: string) =>
    (start.isPending && start.variables === id) ||
    (approve.isPending && approve.variables === id) ||
    (reject.isPending && reject.variables?.id === id);
  const start = useMutation({
    mutationFn: sellerOnboardingService.adminStartReview,
    onSuccess: () => {
      toast.success("Análise iniciada.");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const approve = useMutation({
    mutationFn: sellerOnboardingService.adminApprove,
    onSuccess: () => {
      toast.success("Solicitação aprovada e papel SELLER concedido.");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const reject = useMutation({
    mutationFn: ({ id }: { id: string }) =>
      sellerOnboardingService.adminReject(id, { code, reason }),
    onSuccess: () => {
      toast.success("Solicitação rejeitada.");
      setRejecting(null);
      setReason("");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <AdminLayout
      title="Vendedores"
      description="Análise real de solicitações de vendedor. Produtos, vendas e financeiro seguem demonstrativos."
    >
      <AdminFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar loja ou slug..."
        status={status}
        onStatusChange={setStatus}
        statusOptions={statusOptions}
        risk="all"
        onRiskChange={() => {}}
      />
      <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
        <p className="mb-4 text-sm text-muted-foreground">
          Esta tela não usa métricas fictícias: lista apenas solicitações persistidas no backend.
        </p>
        {query.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando solicitações...</p>
        ) : query.isError ? (
          <div className="space-y-3">
            <p className="text-sm text-destructive">
              Não foi possível carregar solicitações: {(query.error as Error).message}
            </p>
            <Button variant="outline" onClick={() => void query.refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon="Store" title="Nenhuma solicitação encontrada" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loja</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Envio</TableHead>
                    <TableHead>Requisitos</TableHead>
                    <TableHead>Acordo</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">
                        {a.storeName}
                        <p className="max-w-xs truncate text-xs text-muted-foreground">
                          {a.description}
                        </p>
                      </TableCell>
                      <TableCell>{a.requestedSlug}</TableCell>
                      <TableCell>{label(a.status)}</TableCell>
                      <TableCell>
                        {a.submittedAt ? new Date(a.submittedAt).toLocaleString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        E-mail {a.requirements.emailVerified ? "✓" : "!"} · Tel{" "}
                        {a.requirements.phoneVerified ? "✓" : "!"} · 18+{" "}
                        {a.requirements.ageEligible ? "✓" : "!"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {a.requirements.sellerAgreementCurrent
                          ? "Vigente aceito"
                          : "Pendente/desatualizado"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => start.mutate(a.id)}
                            disabled={a.status !== "submitted" || actionPending(a.id)}
                          >
                            Iniciar análise
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              if (
                                confirm(
                                  `Aprovar ${a.storeName}? O perfil será criado e SELLER concedido.`,
                                )
                              )
                                approve.mutate(a.id);
                            }}
                            disabled={
                              !["submitted", "under_review"].includes(a.status) ||
                              actionPending(a.id)
                            }
                          >
                            Aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setRejecting(a)}
                            disabled={
                              !["submitted", "under_review"].includes(a.status) ||
                              actionPending(a.id)
                            }
                          >
                            Rejeitar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {query.hasNextPage && (
              <div className="mt-4 flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => void query.fetchNextPage()}
                  disabled={query.isFetchingNextPage}
                >
                  {query.isFetchingNextPage ? "Carregando mais..." : "Carregar mais"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
      {rejecting && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4">
          <div className="w-full max-w-md rounded-2xl border bg-card p-5 shadow-card">
            <h2 className="font-semibold">Rejeitar {rejecting.storeName}</h2>
            <Select value={code} onValueChange={setCode}>
              <SelectTrigger className="mt-4">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rejectionCodes.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              className="mt-3"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              placeholder="Motivo seguro para o candidato"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRejecting(null)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => reject.mutate({ id: rejecting.id })}
                disabled={reject.isPending}
              >
                Confirmar rejeição
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
