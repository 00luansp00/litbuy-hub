import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth/AuthGate";
import { SellerDashboardLayout } from "@/components/seller-dashboard/SellerDashboardLayout";
import { ListingDraftWizard } from "@/components/seller-dashboard/listing-wizard/ListingDraftWizard";
export const Route = createFileRoute("/vendedor/anuncios/novo")({
  component: () => (
    <AuthGate
      title="Entre para criar um anúncio"
      description="Você precisa estar logado para salvar rascunhos persistentes."
    >
      <SellerDashboardLayout
        title="Criar anúncio"
        description="Rascunho persistente; aprovação não publica no marketplace."
        hideCreateCta
      >
        <ListingDraftWizard />
      </SellerDashboardLayout>
    </AuthGate>
  ),
});
