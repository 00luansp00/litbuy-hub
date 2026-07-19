import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth/AuthGate";
import { SellerDashboardLayout } from "@/components/seller-dashboard/SellerDashboardLayout";
import { ListingDraftWizard } from "@/components/seller-dashboard/listing-wizard/ListingDraftWizard";
import { listingDraftApiService, type ListingDraftRecord } from "@/services/listingDraftApiService";
export const Route = createFileRoute("/vendedor/anuncios/$id/editar")({ component: Page });
function Page() {
  const { id } = Route.useParams() as { id: string };
  const [draft, setDraft] = useState<ListingDraftRecord | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    listingDraftApiService
      .get(id)
      .then(setDraft)
      .catch(() => setError(true));
  }, [id]);
  return (
    <AuthGate title="Entre para editar o anúncio" description="Você precisa estar logado.">
      <SellerDashboardLayout
        title="Editar rascunho"
        description="Retome o wizard persistido; imagens locais não são restauradas."
        hideCreateCta
      >
        {error ? (
          <div className="rounded-2xl border p-6">Erro ao carregar rascunho.</div>
        ) : draft ? (
          <ListingDraftWizard initialDraft={draft} />
        ) : (
          <div className="h-40 animate-pulse rounded-2xl border bg-card" />
        )}
      </SellerDashboardLayout>
    </AuthGate>
  );
}
