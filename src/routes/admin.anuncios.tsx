import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { catalogService } from "@/services/catalogService";
import {
  listingDraftApiService,
  type AdminListingDraftDetail,
  type AdminListingDraftSummary,
  type ListingDraftStatus,
} from "@/services/listingDraftApiService";
import type { Category } from "@/types";

export const Route = createFileRoute("/admin/anuncios")({ component: AdminListingsPage });

const labels: Record<ListingDraftStatus, string> = {
  DRAFT: "Rascunho",
  PENDING_REVIEW: "Pendente",
  UNDER_REVIEW: "Em análise",
  REJECTED: "Rejeitado",
  APPROVED: "Aprovado",
};

const rejectionCodes = [
  "CONTENT_INCOMPLETE",
  "CATEGORY_MISMATCH",
  "NEEDS_CLARIFICATION",
  "POLICY_VIOLATION",
  "PROHIBITED_ITEM",
  "OTHER",
] as const;

function canModerate(status: ListingDraftStatus) {
  return status === "PENDING_REVIEW" || status === "UNDER_REVIEW";
}

function AdminListingsPage() {
  const [items, setItems] = useState<AdminListingDraftSummary[] | null>(null);
  const [selected, setSelected] = useState<AdminListingDraftDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("PENDING_REVIEW");
  const [categoryId, setCategoryId] = useState("all");
  const [categories, setCategories] = useState<Category[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [rejectionCode, setRejectionCode] = useState<(typeof rejectionCodes)[number]>("OTHER");
  const [pending, setPending] = useState<"start" | "approve" | "reject" | "" | string>("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const listSequence = useRef(0);
  const detailSequence = useRef(0);

  useEffect(() => {
    catalogService
      .getCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  const load = useCallback(
    (more = false) => {
      const sequence = ++listSequence.current;
      setError(false);
      setLoading(true);
      listingDraftApiService
        .adminList({
          search,
          status: status === "all" ? undefined : status,
          category: categoryId === "all" ? undefined : categoryId,
          cursor: more ? (cursor ?? undefined) : undefined,
        })
        .then((page) => {
          if (sequence !== listSequence.current) return;
          setItems((old) => {
            if (!more) return page.items;
            const seen = new Set((old ?? []).map((item) => item.id));
            return [...(old ?? []), ...page.items.filter((item) => !seen.has(item.id))];
          });
          setCursor(page.nextCursor);
        })
        .catch(() => {
          if (sequence === listSequence.current) setError(true);
        })
        .finally(() => {
          if (sequence === listSequence.current) setLoading(false);
        });
    },
    [categoryId, cursor, search, status],
  );

  useEffect(() => {
    setItems(null);
    setCursor(null);
    setSelected(null);
    setSelectedId(null);
    load(false);
  }, [search, status, categoryId]);

  const loadDetail = useCallback((id: string) => {
    const sequence = ++detailSequence.current;
    setSelectedId(id);
    setSelected(null);
    setDetailError(false);
    setDetailLoading(true);
    listingDraftApiService
      .adminGet(id)
      .then((detail) => {
        if (sequence === detailSequence.current) setSelected(detail);
      })
      .catch((error) => {
        if (sequence === detailSequence.current) {
          setDetailError(true);
          toast.error((error as { message?: string }).message ?? "Falha ao carregar detalhe");
        }
      })
      .finally(() => {
        if (sequence === detailSequence.current) setDetailLoading(false);
      });
  }, []);

  const mutate = (
    operation: "start" | "approve" | "reject",
    fn: () => Promise<AdminListingDraftDetail>,
  ) => {
    setPending(operation);
    fn()
      .then((detail) => {
        toast.success("Moderação atualizada");
        setSelected(detail);
        setReason("");
        setCursor(null);
        load(false);
      })
      .catch((error) => {
        const apiError = error as { code?: string; message?: string };
        toast.error(
          apiError.code === "LISTING_DRAFT_VERSION_CONFLICT"
            ? "Conflito de versão — detalhe recarregado"
            : (apiError.message ?? "Falha na mutação"),
        );
        if (selectedId) loadDetail(selectedId);
      })
      .finally(() => setPending(""));
  };

  return (
    <AdminLayout
      title="Anúncios"
      description="Fila real de moderação de rascunhos. A aprovação não publica o anúncio no marketplace."
    >
      <div className="mb-4 rounded-xl border border-warning/30 bg-warning/5 p-3 text-sm text-warning">
        A aprovação não cria produto público, publicação, upload, cofre, checkout, pagamento ou KYC.
      </div>
      <div className="mb-4 grid gap-2 md:grid-cols-[1fr_180px_220px_auto]">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar título ou loja..."
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger aria-label="Filtrar status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(labels).map(([key, value]) => (
              <SelectItem key={key} value={key}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger aria-label="Filtrar categoria">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => load(false)}>
          Retry
        </Button>
      </div>
      {error ? (
        <div className="rounded-2xl border p-6">
          <p>Erro ao carregar fila.</p>
          <Button onClick={() => load(false)}>Tentar novamente</Button>
        </div>
      ) : items === null ? (
        <div className="h-64 animate-pulse rounded-2xl border bg-card" />
      ) : items.length === 0 ? (
        <EmptyState icon="Package" title="Nenhum rascunho na fila" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_440px]">
          <div className="space-y-3">
            {items.map((draft) => (
              <button
                key={draft.id}
                onClick={() => loadDetail(draft.id)}
                className="w-full rounded-2xl border bg-card p-4 text-left hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <p className="font-semibold">{draft.title || "Sem título"}</p>
                <p className="text-sm text-muted-foreground">
                  {labels[draft.status]} · {draft.seller?.storeName ?? "Loja"} ·{" "}
                  {draft.category?.name ?? "Sem categoria"} · v{draft.version}
                </p>
                <p className="text-xs text-muted-foreground">
                  Reviewer: {draft.reviewer ? "atribuído" : "—"} · início:{" "}
                  {draft.reviewStartedAt
                    ? new Date(draft.reviewStartedAt).toLocaleString("pt-BR")
                    : "—"}
                </p>
              </button>
            ))}
            {cursor && (
              <Button variant="outline" disabled={loading} onClick={() => load(true)}>
                {loading ? "Carregando…" : "Carregar mais"}
              </Button>
            )}
          </div>
          <aside className="rounded-2xl border bg-card p-4">
            {detailLoading ? (
              <div className="h-40 animate-pulse rounded-xl bg-muted" />
            ) : detailError ? (
              <div className="space-y-3">
                <p className="text-sm text-destructive">Erro ao carregar detalhe.</p>
                {selectedId && (
                  <Button onClick={() => loadDetail(selectedId)}>Tentar novamente</Button>
                )}
              </div>
            ) : selected ? (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">{selected.title || "Sem título"}</h2>
                <p className="text-sm text-muted-foreground">
                  {labels[selected.status]} · modelo {selected.model} · tipo{" "}
                  {selected.productType ?? "—"}
                </p>
                <p className="text-sm">{selected.description}</p>
                <p className="text-sm">
                  Loja: {selected.seller?.storeName} · categoria: {selected.category?.name ?? "—"}/
                  {selected.subcategory?.name ?? "—"}
                </p>
                <p className="text-sm">
                  Preço {selected.price ?? "—"} · estoque {selected.stock ?? "—"} · entrega{" "}
                  {selected.deliveryMode}
                </p>
                <p className="text-xs text-muted-foreground">
                  Reviewer: {selected.reviewer ? "registrado" : "—"} · início{" "}
                  {selected.reviewStartedAt
                    ? new Date(selected.reviewStartedAt).toLocaleString("pt-BR")
                    : "—"}{" "}
                  · revisão{" "}
                  {selected.reviewedAt
                    ? new Date(selected.reviewedAt).toLocaleString("pt-BR")
                    : "—"}{" "}
                  · aprovação{" "}
                  {selected.approvedAt
                    ? new Date(selected.approvedAt).toLocaleString("pt-BR")
                    : "—"}
                </p>
                <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                  Aprovado pela moderação. A publicação pública ainda não está disponível. Não há
                  produto público, upload, cofre, pagamento ou KYC nesta fundação.
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={pending === "start" || selected.status !== "PENDING_REVIEW"}
                    onClick={() =>
                      mutate("start", () =>
                        listingDraftApiService.startReview(selected.id, selected.version),
                      )
                    }
                  >
                    {pending === "start" ? "Iniciando…" : "Iniciar análise"}
                  </Button>
                  <Button
                    disabled={pending === "approve" || !canModerate(selected.status)}
                    onClick={() =>
                      mutate("approve", () =>
                        listingDraftApiService.approve(selected.id, selected.version),
                      )
                    }
                  >
                    {pending === "approve" ? "Aprovando…" : "Aprovar"}
                  </Button>
                </div>
                <Select
                  value={rejectionCode}
                  onValueChange={(value) =>
                    setRejectionCode(value as (typeof rejectionCodes)[number])
                  }
                >
                  <SelectTrigger aria-label="Código de rejeição">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {rejectionCodes.map((code) => (
                      <SelectItem key={code} value={code}>
                        {code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Motivo obrigatório da rejeição"
                />
                <Button
                  variant="destructive"
                  disabled={
                    pending === "reject" ||
                    reason.trim().length < 5 ||
                    !canModerate(selected.status)
                  }
                  onClick={() =>
                    mutate("reject", () =>
                      listingDraftApiService.reject(
                        selected.id,
                        selected.version,
                        rejectionCode,
                        reason,
                      ),
                    )
                  }
                >
                  {pending === "reject" ? "Rejeitando…" : "Rejeitar"}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Selecione um rascunho para moderar.</p>
            )}
          </aside>
        </div>
      )}
    </AdminLayout>
  );
}
