import {
  MousePointerClick,
  UserPlus,
  ShoppingBag,
  Store,
  Receipt,
  Percent,
  Clock,
  Wallet,
  TrendingUp,
} from "lucide-react";
import { formatBRL } from "@/lib/format";
import type { AffiliateStats } from "@/types";

export function AffiliateStatsGrid({ stats }: { stats: AffiliateStats }) {
  const items = [
    { icon: MousePointerClick, label: "Cliques", value: stats.clicks.toLocaleString("pt-BR") },
    { icon: UserPlus, label: "Cadastros", value: stats.signups.toLocaleString("pt-BR") },
    { icon: ShoppingBag, label: "Compradores", value: stats.buyersConverted.toLocaleString("pt-BR") },
    { icon: Store, label: "Vendedores", value: stats.sellersReferred.toLocaleString("pt-BR") },
    { icon: Receipt, label: "Vendas geradas", value: stats.salesGenerated.toLocaleString("pt-BR") },
    { icon: Percent, label: "Conversão", value: `${(stats.conversionRate * 100).toFixed(1)}%` },
    { icon: Clock, label: "Comissão pendente", value: formatBRL(stats.commissionPending) },
    { icon: Wallet, label: "Comissão disponível", value: formatBRL(stats.commissionAvailable) },
    { icon: TrendingUp, label: "Comissão total", value: formatBRL(stats.commissionTotal) },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <div key={it.label} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
              <Icon className="h-3.5 w-3.5" /> {it.label}
            </div>
            <div className="mt-1 text-xl font-semibold text-foreground">{it.value}</div>
          </div>
        );
      })}
    </div>
  );
}
