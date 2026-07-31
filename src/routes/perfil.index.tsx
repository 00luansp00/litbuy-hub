import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, CheckCircle2, ChevronRight } from "lucide-react";
import { AuthGate } from "@/components/auth/AuthGate";
import { AccountLayout } from "@/components/account/AccountLayout";
import { AccountHeader } from "@/components/account/AccountHeader";
import { AccountMetricCard } from "@/components/account/AccountMetricCard";
import { AccountNotifications } from "@/components/account/AccountNotifications";
import { QuickActionsCard } from "@/components/account/QuickActionsCard";
import { RecentFavoritesCard } from "@/components/account/RecentFavoritesCard";
import { RecentMessagesCard } from "@/components/account/RecentMessagesCard";
import { BuyerOrderList } from "@/components/orders/BuyerOrderList";
import { BuyerOrderErrorState } from "@/components/orders/BuyerOrderErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { WalletSummaryCard } from "@/components/account/WalletSummaryCard";
import { VerificationStatusCard } from "@/components/verification/VerificationStatusCard";
import { AffiliateProfileCard } from "@/components/affiliate/AffiliateProfileCard";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/providers/AuthContext";
import { accountService } from "@/services/accountService";
import { productService } from "@/services/productService";
import type { Product } from "@/types";
import { useBuyerOrders } from "@/services/orders";

export const Route = createFileRoute("/perfil/")({
  loader: async () => {
    const [summary, favorites, messages, wallet, notifications, allProducts] = await Promise.all([
      accountService.getAccountSummary(),
      accountService.getRecentFavorites(4),
      accountService.getRecentMessages(4),
      accountService.getWalletSummary(),
      accountService.getAccountNotifications(),
      productService.list(),
    ]);

    const productMap = new Map<string, Product>(allProducts.map((p) => [p.id, p]));
    const favoriteProducts = favorites
      .map((f) => productMap.get(f.productId))
      .filter((p): p is Product => Boolean(p));

    return { summary, favoriteProducts, messages, wallet, notifications };
  },
  component: PerfilPage,
});

function PerfilPage() {
  const { summary, favoriteProducts, messages, wallet, notifications } = Route.useLoaderData();
  const { user } = useAuth();
  const email = user?.email ?? "voce@exemplo.com";

  return (
    <AuthGate>
      <AccountLayout
        header={
          <AccountHeader
            memberSince={summary.memberSince}
            verified={summary.verified}
            level={summary.level}
          />
        }
        title="Visão geral"
        description="Um panorama rápido da sua conta na LIT Buy."
      >
        <section
          aria-label="Métricas da conta"
          className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
        >
          {summary.metrics
            .filter(
              (m: import("@/types").AccountMetric) => !/pedido|compra/i.test(`${m.id} ${m.label}`),
            )
            .map((m: import("@/types").AccountMetric, i: number) => (
              <AccountMetricCard key={m.id} metric={m} index={i} />
            ))}
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-6">
            <RecentBuyerOrders />
            <RecentFavoritesCard products={favoriteProducts} />
            <RecentMessagesCard messages={messages} />
          </div>

          <aside className="space-y-6">
            <VerificationStatusCard status="not_started" compact />
            <WalletSummaryCard wallet={wallet} />
            <AffiliateProfileCard status="active" clicks={1284} commissionAvailable={312.7} />
            <Link
              to="/perfil/preferencias"
              className="group block rounded-2xl border border-border bg-surface/60 p-4 transition hover:border-primary/40"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
                  <Mail className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    Preferências de comunicação
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{email}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5" />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  <CheckCircle2 className="h-3 w-3" /> E-mail verificado (mock)
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  Plataforma
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  E-mail
                </Badge>
              </div>
            </Link>
            <AccountNotifications notifications={notifications} />
            <QuickActionsCard />
          </aside>
        </div>
      </AccountLayout>
    </AuthGate>
  );
}

export function RecentBuyerOrders() {
  const query = useBuyerOrders(1, 5);
  return (
    <section aria-labelledby="recent-orders-title" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 id="recent-orders-title" className="text-lg font-bold">
          Pedidos recentes
        </h2>
        <Link to="/pedidos" className="text-sm text-primary hover:underline">
          Ver todos
        </Link>
      </div>
      {query.isPending && (
        <div aria-live="polite">
          <span className="sr-only">Carregando pedidos recentes...</span>
          <Skeleton className="h-28" />
        </div>
      )}
      {query.isError && (
        <BuyerOrderErrorState
          message="Não foi possível carregar os pedidos recentes. O restante do perfil continua disponível."
          retry={() => void query.refetch()}
        />
      )}
      {query.data?.items.length === 0 && (
        <p className="rounded-xl border p-5 text-sm text-muted-foreground">
          Nenhum pedido recente encontrado.
        </p>
      )}
      {query.data && query.data.items.length > 0 && <BuyerOrderList orders={query.data.items} />}
    </section>
  );
}
