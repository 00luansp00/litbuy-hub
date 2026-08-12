import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, ArrowRight } from "lucide-react";
import { AuthGate } from "@/components/auth/AuthGate";
import { SellerDashboardLayout } from "@/components/seller-dashboard/SellerDashboardLayout";
import { SellerMetricCard } from "@/components/seller-dashboard/SellerMetricCard";
import { SellerRecentSalesCard } from "@/components/seller-dashboard/SellerRecentSalesCard";
import { SellerFinanceSummaryCard } from "@/components/seller-dashboard/SellerFinanceSummaryCard";
import { SellerReviewsCard } from "@/components/seller-dashboard/SellerReviewsCard";
import { SellerNotificationsCard } from "@/components/seller-dashboard/SellerNotificationsCard";
import { SellerQuickActions } from "@/components/seller-dashboard/SellerQuickActions";
import { SellerPerformanceCard } from "@/components/seller-dashboard/SellerPerformanceCard";
import { SellerOnboardingCard } from "@/components/seller-dashboard/SellerOnboardingCard";
import { SellerLevelCard } from "@/components/seller-dashboard/SellerLevelCard";
import { VerificationStatusCard } from "@/components/verification/VerificationStatusCard";

import { sellerDashboardService } from "@/services/sellerDashboardService";
import type {
  SellerDashboardSummary,
  SellerListing,
  SellerNotification,
  SellerReview,
  SellerSalePreview,
} from "@/types";
import { useSellerFinanceSummary } from "@/services/finance/sellerFinance";

export const Route = createFileRoute("/vendedor/")({
  component: VendedorPage,
});

function VendedorPage() {
  return (
    <>
      <div className="container-lit pt-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Os dados de anúncios e métricas gerais desta área ainda são demonstrativos. O financeiro
          usa o ledger real do Alpha.
        </div>
      </div>
      <AuthGate
        title="Entre para acessar sua área de vendedor"
        description="Você precisa estar logado na LIT Buy para vender. Faça login ou crie sua conta em segundos."
      >
        <VendedorDashboard />
      </AuthGate>
    </>
  );
}

function VendedorDashboard() {
  const [summary, setSummary] = useState<SellerDashboardSummary | null>(null);
  const [sales, setSales] = useState<SellerSalePreview[]>([]);
  const [listings, setListings] = useState<SellerListing[]>([]);
  const [reviews, setReviews] = useState<SellerReview[]>([]);
  const financial = useSellerFinanceSummary();
  const [notifications, setNotifications] = useState<SellerNotification[]>([]);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      sellerDashboardService.getSellerDashboardSummary(),
      sellerDashboardService.getSellerRecentSales(5),
      sellerDashboardService.getSellerListings(),
      sellerDashboardService.getSellerReviews(4),
      sellerDashboardService.getSellerNotifications(),
    ]).then(([s, sa, li, re, no]) => {
      if (!mounted) return;
      setSummary(s);
      setSales(sa);
      setListings(li);
      setReviews(re);
      setNotifications(no);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <SellerDashboardLayout
      title="Visão geral"
      description="Acompanhe seus anúncios e vendas; os saldos financeiros vêm do ledger Alpha."
    >
      {/* Métricas */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(summary?.metrics ?? []).map((m, i) => (
          <SellerMetricCard key={m.id} metric={m} index={i} />
        ))}
      </div>

      <SellerOnboardingCard />

      <div className="grid gap-4 md:grid-cols-2">
        <VerificationStatusCard status="not_started" compact />
        <SellerLevelCard />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Aviso: na operação real, a verificação de identidade poderá ser exigida para vender, sacar
        ou acessar recursos avançados.
      </p>

      {/* Duas colunas: vendas + performance/financeiro */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <SellerRecentSalesCard sales={sales} />
        <div className="space-y-6">
          {financial.data && <SellerFinanceSummaryCard financial={financial.data} compact />}
          <SellerPerformanceCard listings={listings} />
        </div>
      </div>

      {/* Alertas + Atalhos + Avaliações */}
      <div className="grid gap-6 lg:grid-cols-3">
        <SellerNotificationsCard notifications={notifications} />
        <SellerQuickActions />
        <SellerReviewsCard reviews={reviews} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Users className="h-4 w-4 text-primary" /> Afiliados LIT Buy
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Indique compradores e vendedores para a LIT Buy e acumule comissão demonstrativa.
              Comissão real exigirá backend.
            </p>
          </div>
          <Link
            to="/afiliados"
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
          >
            Abrir programa <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </SellerDashboardLayout>
  );
}
