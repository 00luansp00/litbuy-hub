import { createFileRoute, Link } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { AuthGate } from "@/components/auth/AuthGate";
import { AccountLayout } from "@/components/account/AccountLayout";
import { AccountHeader } from "@/components/account/AccountHeader";
import { WalletSummaryCard } from "@/components/account/WalletSummaryCard";
import { LitPointsSummaryCard } from "@/components/account/LitPointsSummaryCard";
import { accountService } from "@/services/accountService";
import { affiliateService } from "@/services/affiliateService";
import { formatBRL } from "@/lib/format";
import { useEffect, useState } from "react";
import type { AffiliateCommissionSummary } from "@/types";


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
  const [aff, setAff] = useState<AffiliateCommissionSummary | null>(null);

  useEffect(() => {
    affiliateService.getAffiliateCommissionSummary().then(setAff);
  }, []);

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
        <div className="space-y-6">
          <div className="grid gap-3 md:grid-cols-3">
            <BalanceCard title="Saldo LIT" subtitle="Movimentação financeira mockada" value={formatBRL(wallet.availableBalance)} />
            <BalanceCard title="LIT Points" subtitle="Programa próprio — não é dinheiro" value={`${wallet.points ?? 0} pts`} />
            <BalanceCard
              title="Comissões de afiliado"
              subtitle="Demonstrativa — exigirá backend"
              value={aff ? formatBRL(aff.available) : "—"}
              cta={<Link to="/afiliados" className="text-xs text-primary hover:underline">Abrir programa de afiliados</Link>}
              icon={<Users className="h-4 w-4 text-primary" />}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Comissões de afiliado são demonstrativas neste MVP e exigirão backend
            financeiro para saque real. Elas não se misturam com o Saldo LIT nem
            com LIT Points.
          </p>
          <WalletSummaryCard wallet={wallet} showAll hideHeader />
          <LitPointsSummaryCard />
        </div>

      </AccountLayout>
    </AuthGate>
  );
}

function BalanceCard({
  title,
  subtitle,
  value,
  cta,
  icon,
}: {
  title: string;
  subtitle: string;
  value: string;
  cta?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
        {icon}
        {title}
      </div>
      <div className="mt-1 text-xl font-semibold text-foreground">{value}</div>
      <p className="mt-1 text-[11px] text-muted-foreground">{subtitle}</p>
      {cta && <div className="mt-2">{cta}</div>}
    </div>
  );
}
