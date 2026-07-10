import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth/AuthGate";
import { AccountLayout } from "@/components/account/AccountLayout";
import { AccountHeader } from "@/components/account/AccountHeader";
import { RecentOrdersCard } from "@/components/account/RecentOrdersCard";
import { accountService } from "@/services/accountService";

export const Route = createFileRoute("/pedidos")({
  loader: async () => {
    const [summary, orders] = await Promise.all([
      accountService.getAccountSummary(),
      accountService.getRecentOrders(10),
    ]);
    return { summary, orders };
  },
  component: PedidosPage,
});

function PedidosPage() {
  const { summary, orders } = Route.useLoaderData();
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
        title="Meus pedidos"
        description="Acompanhe todas as suas compras na LIT Buy."
      >
        <RecentOrdersCard orders={orders} hideHeader />
      </AccountLayout>
    </AuthGate>
  );
}
