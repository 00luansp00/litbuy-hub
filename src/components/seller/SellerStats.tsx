import { motion } from "motion/react";
import {
  Clock,
  MessageCircle,
  Package,
  Star,
  ThumbsUp,
  TrendingUp,
  Users,
} from "lucide-react";
import { formatCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SellerStats as SellerStatsType } from "@/types";

interface SellerStatsProps {
  stats: SellerStatsType;
  className?: string;
}

/**
 * SellerStats — grid de cards com métricas principais do vendedor.
 */
export function SellerStats({ stats, className }: SellerStatsProps) {
  const items = [
    {
      icon: Package,
      label: "Produtos ativos",
      value: formatCompact(stats.activeProducts),
      tone: "text-primary",
    },
    {
      icon: TrendingUp,
      label: "Vendas realizadas",
      value: formatCompact(stats.totalSales),
      tone: "text-success",
    },
    {
      icon: Star,
      label: "Avaliações",
      value: formatCompact(stats.totalReviews),
      tone: "text-warning",
    },
    {
      icon: Users,
      label: "Seguidores",
      value: formatCompact(stats.followers),
      tone: "text-accent",
    },
    {
      icon: Clock,
      label: "Tempo de resposta",
      value: stats.responseTime,
      tone: "text-primary",
    },
    {
      icon: ThumbsUp,
      label: "Satisfação",
      value: `${stats.satisfactionRate}%`,
      tone: "text-success",
    },
  ] as const;

  return (
    <section
      className={cn(
        "grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6",
        className,
      )}
      aria-label="Estatísticas do vendedor"
    >
      {items.map((item, i) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.3, delay: Math.min(i * 0.05, 0.3) }}
          className="rounded-xl border border-border bg-card p-4 shadow-card transition-colors hover:border-primary/40"
        >
          <div className="flex items-center gap-2">
            <item.icon className={cn("h-4 w-4", item.tone)} />
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {item.label}
            </span>
          </div>
          <div className="mt-2 text-xl font-bold text-foreground">
            {item.value}
          </div>
        </motion.div>
      ))}

      {/* Ícone Chat mantido no import para referência futura (novas métricas). */}
      <span className="sr-only" aria-hidden>
        <MessageCircle />
      </span>
    </section>
  );
}
