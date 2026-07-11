import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth/AuthGate";
import { SellerDashboardLayout } from "@/components/seller-dashboard/SellerDashboardLayout";
import { SellerMetricCard } from "@/components/seller-dashboard/SellerMetricCard";
import { SellerRecentSalesCard } from "@/components/seller-dashboard/SellerRecentSalesCard";
import { SellerFinancialCard } from "@/components/seller-dashboard/SellerFinancialCard";
import { SellerReviewsCard } from "@/components/seller-dashboard/SellerReviewsCard";
import { SellerNotificationsCard } from "@/components/seller-dashboard/SellerNotificationsCard";
import { SellerQuickActions } from "@/components/seller-dashboard/SellerQuickActions";
import { SellerPerformanceCard } from "@/components/seller-dashboard/SellerPerformanceCard";
import { SellerOnboardingCard } from "@/components/seller-dashboard/SellerOnboardingCard";
import { SellerLevelCard } from "@/components/seller-dashboard/SellerLevelCard";

import { sellerDashboardService } from "@/services/sellerDashboardService";
import type {
  SellerDashboardSummary,
  SellerFinancialSummary,
  SellerListing,
  SellerNotification,
  SellerReview,
  SellerSalePreview,
} from "@/types";

export const Route = createFileRoute("/vendedor/")({
  component: VendedorPage,
});

function VendedorPage() {
  return (
    <AuthGate
      title="Entre para acessar sua área de vendedor"
      description="Você precisa estar logado na LIT Buy para vender. Faça login ou crie sua conta em segundos."
    >
      <VendedorDashboard />
    </AuthGate>
  );
}

function VendedorDashboard() {
  const [summary, setSummary] = useState<SellerDashboardSummary | null>(null);
  const [sales, setSales] = useState<SellerSalePreview[]>([]);
  const [listings, setListings] = useState<SellerListing[]>([]);
  const [reviews, setReviews] = useState<SellerReview[]>([]);
  const [financial, setFinancial] = useState<SellerFinancialSummary | null>(null);
  const [notifications, setNotifications] = useState<SellerNotification[]>([]);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      sellerDashboardService.getSellerDashboardSummary(),
      sellerDashboardService.getSellerRecentSales(5),
      sellerDashboardService.getSellerListings(),
      sellerDashboardService.getSellerReviews(4),
      sellerDashboardService.getSellerFinancialSummary(),
      sellerDashboardService.getSellerNotifications(),
    ]).then(([s, sa, li, re, fi, no]) => {
      if (!mounted) return;
      setSummary(s);
      setSales(sa);
      setListings(li);
      setReviews(re);
      setFinancial(fi);
      setNotifications(no);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <SellerDashboardLayout
      title="Visão geral"
      description="Acompanhe seus anúncios, vendas e finanças em modo demonstração."
    >
      {/* Métricas */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(summary?.metrics ?? []).map((m, i) => (
          <SellerMetricCard key={m.id} metric={m} index={i} />
        ))}
      </div>

      <SellerOnboardingCard />

      <SellerLevelCard />


      {/* Duas colunas: vendas + performance/financeiro */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <SellerRecentSalesCard sales={sales} />
        <div className="space-y-6">
          {financial && <SellerFinancialCard financial={financial} compact />}
          <SellerPerformanceCard listings={listings} />
        </div>
      </div>

      {/* Alertas + Atalhos + Avaliações */}
      <div className="grid gap-6 lg:grid-cols-3">
        <SellerNotificationsCard notifications={notifications} />
        <SellerQuickActions />
        <SellerReviewsCard reviews={reviews} />
      </div>
    </SellerDashboardLayout>
  );
}
