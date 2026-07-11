import { motion } from "motion/react";
import { Eye, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/EmptyState";
import { formatBRL } from "@/lib/format";
import type { SellerListing } from "@/types";

interface SellerPerformanceCardProps {
  listings: SellerListing[];
}

export function SellerPerformanceCard({ listings }: SellerPerformanceCardProps) {
  const top = [...listings]
    .filter((l) => l.status === "active" || l.status === "sold")
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 4);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl border border-border bg-card p-5 shadow-card"
    >
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground">Melhor performance</h3>
          <p className="text-xs text-muted-foreground">Anúncios que mais convertem.</p>
        </div>
        <Badge variant="secondary" className="gap-1">
          <TrendingUp className="h-3 w-3" /> Últimos 30d
        </Badge>
      </header>

      {top.length === 0 ? (
        <EmptyState
          icon="TrendingUp"
          title="Sem dados suficientes"
          description="Publique anúncios e receba visitas para ver a performance."
        />
      ) : (
        <ul className="space-y-3">
          {top.map((l) => (
            <li key={l.id} className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-surface">
                <img src={l.image} alt={l.title} className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="line-clamp-1 text-sm font-medium text-foreground">
                  {l.title}
                </div>
                <div className="mt-0.5 inline-flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{l.sales} vendas</span>
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-3 w-3" /> {l.views.toLocaleString("pt-BR")}
                  </span>
                </div>
              </div>
              <div className="text-sm font-semibold text-foreground">
                {formatBRL(l.price)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </motion.section>
  );
}
