import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth/AuthGate";
import { AccountLayout } from "@/components/account/AccountLayout";
import { AccountHeader } from "@/components/account/AccountHeader";
import { RecentMessagesCard } from "@/components/account/RecentMessagesCard";
import { accountService } from "@/services/accountService";

export const Route = createFileRoute("/mensagens")({
  loader: async () => {
    const [summary, messages] = await Promise.all([
      accountService.getAccountSummary(),
      accountService.getRecentMessages(10),
    ]);
    return { summary, messages };
  },
  component: MensagensPage,
});

function MensagensPage() {
  const { summary, messages } = Route.useLoaderData();
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
        title="Mensagens"
        description="Suas conversas com vendedores da LIT Buy."
      >
        <RecentMessagesCard messages={messages} hideHeader />
      </AccountLayout>
    </AuthGate>
  );
}
