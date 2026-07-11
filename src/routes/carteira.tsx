import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth/AuthGate";
import { AccountLayout } from "@/components/account/AccountLayout";
import { AccountHeader } from "@/components/account/AccountHeader";
import { WalletSummaryCard } from "@/components/account/WalletSummaryCard";
import { LitPointsSummaryCard } from "@/components/account/LitPointsSummaryCard";
import { accountService } from "@/services/accountService";


export const Route = createFileRoute("/carteira")({
  loader: async () => {
    const [summary, wallet] = await Promise.all([
      accountService.getAccountSummary(),
      accountService.getWalletSummary(),
    ]);
    return { summary, wallet };
  },
  component: CarteiraPage,
});

function CarteiraPage() {
  const { summary, wallet } = Route.useLoaderData();
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
        title="Carteira LIT"
        description="Saldo interno, transações e movimentações da sua conta."
      >
        <WalletSummaryCard wallet={wallet} showAll hideHeader />
      </AccountLayout>
    </AuthGate>
  );
}
