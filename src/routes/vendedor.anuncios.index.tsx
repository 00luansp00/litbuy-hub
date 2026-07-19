import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AuthGate } from "@/components/auth/AuthGate";
import { SellerDashboardLayout } from "@/components/seller-dashboard/SellerDashboardLayout";
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
import {
  listingDraftApiService,
  type SellerListingDraftSummary,
  type ListingDraftStatus,
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
function ListingsPage() {
  const [items, setItems] = useState<SellerListingDraftSummary[] | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const load = (more = false) => {
    setError(false);
    listingDraftApiService
      .list({
        search,
        status: status === "all" ? undefined : status,
        cursor: more ? (cursor ?? undefined) : undefined,
      })
      .then((p) => {
        setItems((old) =>
          more
            ? [...(old ?? []), ...p.items.filter((x) => !(old ?? []).some((o) => o.id === x.id))]
            : p.items,
        );
        setCursor(p.nextCursor);
      })
      .catch(() => setError(true));
  };
  useEffect(() => {
    load(false);
  }, [search, status]);
  const submit = (d: SellerListingDraftSummary) =>
    listingDraftApiService
      .submit(d.id, d.version)
      .then(() => {
        toast.success("Enviado para análise");
        load(false);
      })
      .catch((e) => toast.error(e.message));
  return (
    <SellerDashboardLayout
      title="Meus anúncios"
      description="Listagem real de rascunhos persistentes; aprovação não publica no marketplace."
    >
      <div className="mb-4 flex gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar rascunho..."
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48">
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
          {items.map((d) => (
            <div key={d.id} className="rounded-2xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{d.title || "Sem título"}</p>
                  <p className="text-sm text-muted-foreground">
                    {labels[d.status]} · {d.model} · {d.category?.name ?? "Sem categoria"} · etapa{" "}
                    {d.wizardStep}/6 · v{d.version}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Preço: {d.price ?? "—"} · Estoque: {d.stock ?? "—"} · Atualizado:{" "}
                    {new Date(d.updatedAt).toLocaleString("pt-BR")}
                  </p>
                  {d.rejectionReason && (
                    <p className="mt-2 text-sm text-destructive">
                      {d.rejectionCode}: {d.rejectionReason}
                    </p>
                  )}
                  {d.status === "APPROVED" && (
                    <p className="mt-2 text-sm text-primary">
                      Aprovado pela moderação. A publicação pública ainda não está disponível.
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button asChild variant="outline">
                    <a href={`/vendedor/anuncios/${d.id}/editar`}>
                      {["DRAFT", "REJECTED"].includes(d.status) ? "Continuar" : "Visualizar"}
                    </a>
                  </Button>
                  {["DRAFT", "REJECTED", "PENDING_REVIEW"].includes(d.status) && (
                    <Button
                      disabled={!["DRAFT", "REJECTED"].includes(d.status)}
                      onClick={() => submit(d)}
                    >
                      Enviar
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {cursor && (
            <Button variant="outline" onClick={() => load(true)}>
              Carregar mais
            </Button>
          )}
        </div>
      )}
    </SellerDashboardLayout>
  );
}
