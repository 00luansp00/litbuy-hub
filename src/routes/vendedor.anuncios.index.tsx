import { useCallback, useEffect, useRef, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AuthGate } from "@/components/auth/AuthGate";
import { SellerDashboardLayout } from "@/components/seller-dashboard/SellerDashboardLayout";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { ProductImageManager } from "@/components/seller-dashboard/product-images/ProductImageManager";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listingDraftApiService,
  type ListingDraftStatus,
  type SellerListingDraftSummary,
} from "@/services/listingDraftApiService";

export const Route = createFileRoute("/vendedor/anuncios/")({
  component: () => (
    <AuthGate
      title="Entre para acessar seus anúncios"
      description="Você precisa estar logado para gerenciar seus rascunhos."
    >
      <ListingsPage />
    </AuthGate>
  ),
});

const labels: Record<ListingDraftStatus, string> = {
  DRAFT: "Rascunho",
  PENDING_REVIEW: "Pendente",
  UNDER_REVIEW: "Em análise",
  REJECTED: "Rejeitado",
  APPROVED: "Aprovado",
};

function canSubmit(status: ListingDraftStatus) {
  return status === "DRAFT" || status === "REJECTED";
}

function ListingsPage() {
  const [items, setItems] = useState<SellerListingDraftSummary[] | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const requestSequence = useRef(0);

  const load = useCallback(
    (more = false) => {
      const sequence = ++requestSequence.current;
      setError(false);
      setLoading(true);
      listingDraftApiService
        .list({
          search,
          status: status === "all" ? undefined : status,
          cursor: more ? (cursor ?? undefined) : undefined,
        })
        .then((page) => {
          if (sequence !== requestSequence.current) return;
          setItems((old) => {
            if (!more) return page.items;
            const seen = new Set((old ?? []).map((item) => item.id));
            return [...(old ?? []), ...page.items.filter((item) => !seen.has(item.id))];
          });
          setCursor(page.nextCursor);
        })
        .catch(() => {
          if (sequence === requestSequence.current) setError(true);
        })
        .finally(() => {
          if (sequence === requestSequence.current) setLoading(false);
        });
    },
    [cursor, search, status],
  );

  useEffect(() => {
    setItems(null);
    setCursor(null);
    load(false);
  }, [search, status]);

  const submit = async (draft: SellerListingDraftSummary) => {
    if (!canSubmit(draft.status) || submittingId) return;
    setSubmittingId(draft.id);
    try {
      await listingDraftApiService.submit(draft.id, draft.version);
      toast.success("Enviado para análise");
      setCursor(null);
      load(false);
    } catch (error) {
      const apiError = error as { code?: string; message?: string };
      toast.error(
        apiError.code === "LISTING_DRAFT_VERSION_CONFLICT"
          ? "Conflito de versão — recarregando rascunhos"
          : (apiError.message ?? "Falha ao enviar"),
      );
      load(false);
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <SellerDashboardLayout
      title="Meus anúncios"
      description="Listagem real de rascunhos persistentes; aprovação não publica no marketplace."
    >
      <div className="mb-4 flex flex-col gap-2 md:flex-row">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar rascunho..."
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full md:w-48" aria-label="Filtrar status">
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
      </div>
      {error ? (
        <div className="rounded-2xl border p-6">
          <p>Erro ao carregar.</p>
          <Button onClick={() => load(false)}>Tentar novamente</Button>
        </div>
      ) : items === null ? (
        <div className="h-40 animate-pulse rounded-2xl border bg-card" />
      ) : items.length === 0 ? (
        <EmptyState
          icon="Package"
          title="Você ainda não tem rascunhos"
          description="Salve o primeiro anúncio persistente."
          action={{ label: "Criar anúncio", to: "/vendedor/anuncios/novo" }}
        />
      ) : (
        <div className="space-y-3">
          {items.map((draft) => (
            <div key={draft.id} className="rounded-2xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{draft.title || "Sem título"}</p>
                  <p className="text-sm text-muted-foreground">
                    {labels[draft.status]} · {draft.model} ·{" "}
                    {draft.category?.name ?? "Sem categoria"}
                    {draft.subcategory ? ` / ${draft.subcategory.name}` : ""} ·{" "}
                    {draft.productType ?? "sem tipo"} · etapa {draft.wizardStep}/6 · v
                    {draft.version}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Preço: {draft.price ?? "—"} · Estoque: {draft.stock ?? "—"} · Atualizado:{" "}
                    {new Date(draft.updatedAt).toLocaleString("pt-BR")}
                  </p>
                  {draft.rejectionReason && (
                    <p className="mt-2 text-sm text-destructive">
                      {draft.rejectionCode}: {draft.rejectionReason}
                    </p>
                  )}
                  {draft.status === "APPROVED" && (
                    <p className="mt-2 text-sm text-primary">
                      Aprovado pela moderação. A publicação pública ainda não está disponível.
                    </p>
                  )}
                  {draft.materializedProduct?.status === "UNPUBLISHED" && (
                    <ProductImageManager productId={draft.materializedProduct.id} />
                  )}
                </div>
                <div className="flex gap-2">
                  <Button asChild variant="outline">
                    <Link to="/vendedor/anuncios/$id/editar" params={{ id: draft.id }}>
                      {canSubmit(draft.status) ? "Continuar" : "Visualizar"}
                    </Link>
                  </Button>
                  {canSubmit(draft.status) && (
                    <Button disabled={submittingId === draft.id} onClick={() => submit(draft)}>
                      {submittingId === draft.id ? "Enviando…" : "Enviar"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {cursor && (
            <Button variant="outline" disabled={loading} onClick={() => load(true)}>
              {loading ? "Carregando…" : "Carregar mais"}
            </Button>
          )}
        </div>
      )}
    </SellerDashboardLayout>
  );
}
