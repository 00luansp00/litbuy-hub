import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth/AuthGate";
import { SellerDashboardLayout } from "@/components/seller-dashboard/SellerDashboardLayout";
import { SellerRecentSalesCard } from "@/components/seller-dashboard/SellerRecentSalesCard";
import { sellerDashboardService } from "@/services/sellerDashboardService";
import type { SellerSalePreview } from "@/types";

export const Route = createFileRoute("/vendedor/vendas")({
  component: () => (
    <AuthGate
      title="Entre para acessar suas vendas"
      description="Você precisa estar logado para acompanhar seus pedidos."
    >
      <VendasPage />
    </AuthGate>
  ),
});

function VendasPage() {
  const [sales, setSales] = useState<SellerSalePreview[] | null>(null);

  useEffect(() => {
    let mounted = true;
    sellerDashboardService.getSellerRecentSales(20).then((s) => {
      if (mounted) setSales(s);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <SellerDashboardLayout
      title="Vendas"
      description="Histórico mockado — nenhum pedido real é criado nesta demonstração."
    >
      {sales === null ? (
        <div className="h-40 animate-pulse rounded-2xl border border-border bg-card" />
      ) : (
        <SellerRecentSalesCard sales={sales} title="Todas as vendas" />
      )}
    </SellerDashboardLayout>
  );
}
