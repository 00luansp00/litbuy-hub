import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth/AuthGate";
import { SellerDashboardLayout } from "@/components/seller-dashboard/SellerDashboardLayout";
import { SellerListingsTable } from "@/components/seller-dashboard/SellerListingsTable";
import { EmptyState } from "@/components/common/EmptyState";
import { sellerDashboardService } from "@/services/sellerDashboardService";
import type { SellerListing } from "@/types";

export const Route = createFileRoute("/vendedor/anuncios")({
  component: () => (
    <AuthGate
      title="Entre para acessar seus anúncios"
      description="Você precisa estar logado para gerenciar seus anúncios."
    >
      <ListingsPage />
    </AuthGate>
  ),
});

function ListingsPage() {
  const [listings, setListings] = useState<SellerListing[] | null>(null);

  useEffect(() => {
    let mounted = true;
    sellerDashboardService.getSellerListings().then((l) => {
      if (mounted) setListings(l);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <SellerDashboardLayout
      title="Meus anúncios"
      description="Gerencie estoque, preços e status dos seus produtos."
    >
      {listings === null ? (
        <div className="h-40 animate-pulse rounded-2xl border border-border bg-card" />
      ) : listings.length === 0 ? (
        <EmptyState
          icon="Package"
          title="Você ainda não tem anúncios"
          description="Publique seu primeiro produto para começar a vender."
          action={{ label: "Criar anúncio", to: "/vendedor/anuncios/novo" }}
        />
      ) : (
        <SellerListingsTable listings={listings} />
      )}
    </SellerDashboardLayout>
  );
}
