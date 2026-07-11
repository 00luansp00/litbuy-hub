import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth/AuthGate";
import { AccountLayout } from "@/components/account/AccountLayout";
import { AccountHeader } from "@/components/account/AccountHeader";
import { AccountMetricCard } from "@/components/account/AccountMetricCard";
import { AccountNotifications } from "@/components/account/AccountNotifications";
import { QuickActionsCard } from "@/components/account/QuickActionsCard";
import { RecentFavoritesCard } from "@/components/account/RecentFavoritesCard";
import { RecentMessagesCard } from "@/components/account/RecentMessagesCard";
import { RecentOrdersCard } from "@/components/account/RecentOrdersCard";
import { WalletSummaryCard } from "@/components/account/WalletSummaryCard";
import { VerificationStatusCard } from "@/components/verification/VerificationStatusCard";
import { accountService } from "@/services/accountService";
import { productService } from "@/services/productService";
import type { Product } from "@/types";

export const Route = createFileRoute("/perfil/")({
  loader: async () => {
    const [summary, orders, favorites, messages, wallet, notifications, allProducts] =
      await Promise.all([
        accountService.getAccountSummary(),
        accountService.getRecentOrders(5),
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

    return { summary, orders, favoriteProducts, messages, wallet, notifications };
  },
  component: PerfilPage,
});

function PerfilPage() {
  const { summary, orders, favoriteProducts, messages, wallet, notifications } =
    Route.useLoaderData();

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
          {summary.metrics.map((m: import("@/types").AccountMetric, i: number) => (
            <AccountMetricCard key={m.id} metric={m} index={i} />
          ))}

        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-6">
            <RecentOrdersCard orders={orders} />
            <RecentFavoritesCard products={favoriteProducts} />
            <RecentMessagesCard messages={messages} />
          </div>

          <aside className="space-y-6">
            <VerificationStatusCard status="not_started" compact />
            <WalletSummaryCard wallet={wallet} />
            <AccountNotifications notifications={notifications} />
            <QuickActionsCard />
          </aside>
        </div>
      </AccountLayout>
    </AuthGate>
  );
}
