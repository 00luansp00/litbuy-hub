import { useEffect, useState } from "react";
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
import {
  listingDraftApiService,
  type AdminListingDraftDetail,
  type AdminListingDraftSummary,
  type ListingDraftStatus,
} from "@/services/listingDraftApiService";
export const Route = createFileRoute("/admin/anuncios")({ component: AdminListingsPage });
const labels: Record<ListingDraftStatus, string> = {
  DRAFT: "Rascunho",
  PENDING_REVIEW: "Pendente",
  UNDER_REVIEW: "Em análise",
  REJECTED: "Rejeitado",
  APPROVED: "Aprovado",
};
function AdminListingsPage() {
  const [items, setItems] = useState<AdminListingDraftSummary[] | null>(null);
  const [selected, setSelected] = useState<AdminListingDraftDetail | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("PENDING_REVIEW");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState(false);
  const load = () => {
    setError(false);
    listingDraftApiService
      .adminList({ search, status: status === "all" ? undefined : status })
      .then((p) => setItems(p.items))
      .catch(() => setError(true));
  };
  useEffect(load, [search, status]);
  const mutate = (id: string, fn: () => Promise<AdminListingDraftDetail>) => {
    setPending(id);
    fn()
      .then((d) => {
        toast.success("Moderação atualizada");
        setSelected(d);
        load();
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setPending(""));
  };
  return (
    <AdminLayout
      title="Anúncios"
      description="Fila real de moderação de rascunhos. A aprovação não publica o anúncio no marketplace."
    >
      <div className="mb-4 flex gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar título..."
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(labels).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={load}>
          Retry
        </Button>
      </div>
      {error ? (
        <div className="rounded-2xl border p-6">Erro ao carregar fila.</div>
      ) : items === null ? (
        <div className="h-64 animate-pulse rounded-2xl border bg-card" />
      ) : items.length === 0 ? (
        <EmptyState icon="Package" title="Nenhum rascunho na fila" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
          <div className="space-y-3">
            {items.map((d) => (
              <button
                key={d.id}
                onClick={() => {
                  setSelected(null);
                  setDetailLoading(true);
                  const selectedId = d.id;
                  listingDraftApiService
                    .adminGet(selectedId)
                    .then((detail) =>
                      setSelected((current) =>
                        current && current.id !== selectedId ? current : detail,
                      ),
                    )
                    .catch((error) => toast.error(error.message ?? "Falha ao carregar detalhe"))
                    .finally(() => setDetailLoading(false));
                }}
                className="w-full rounded-2xl border bg-card p-4 text-left hover:border-primary"
              >
                <p className="font-semibold">{d.title || "Sem título"}</p>
                <p className="text-sm text-muted-foreground">
                  {labels[d.status]} · {d.seller?.storeName ?? "Loja"} ·{" "}
                  {d.category?.name ?? "Sem categoria"} · v{d.version}
                </p>
                <p className="text-xs text-muted-foreground">
                  Atualizado: {new Date(d.updatedAt).toLocaleString("pt-BR")}
                </p>
              </button>
            ))}
          </div>
          <aside className="rounded-2xl border bg-card p-4">
            {detailLoading ? (
              <div className="h-40 animate-pulse rounded-xl bg-muted" />
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
                <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                  Aprovado pela moderação. A publicação pública ainda não está disponível. Não há
                  produto público, upload, cofre, pagamento ou KYC nesta fundação.
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={pending === selected.id || selected.status !== "PENDING_REVIEW"}
                    onClick={() =>
                      mutate(selected.id, () =>
                        listingDraftApiService.startReview(selected.id, selected.version),
                      )
                    }
                  >
                    Iniciar análise
                  </Button>
                  <Button
                    disabled={
                      pending === selected.id ||
                      !["PENDING_REVIEW", "UNDER_REVIEW"].includes(selected.status)
                    }
                    onClick={() =>
                      mutate(selected.id, () =>
                        listingDraftApiService.approve(selected.id, selected.version),
                      )
                    }
                  >
                    Aprovar
                  </Button>
                </div>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Motivo obrigatório da rejeição"
                />
                <Button
                  variant="destructive"
                  disabled={
                    pending === selected.id ||
                    reason.trim().length < 5 ||
                    !["PENDING_REVIEW", "UNDER_REVIEW"].includes(selected.status)
                  }
                  onClick={() =>
                    mutate(selected.id, () =>
                      listingDraftApiService.reject(selected.id, selected.version, "OTHER", reason),
                    )
                  }
                >
                  Rejeitar
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
