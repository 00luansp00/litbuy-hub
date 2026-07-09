import { motion } from "motion/react";
import {
  BadgeCheck,
  CalendarDays,
  Clock,
  Package,
  Star,
  TrendingUp,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Seller } from "@/types";

interface SellerHeroProps {
  seller: Seller;
  className?: string;
}

/**
 * SellerHero — cabeçalho premium do perfil público de vendedor.
 * Combina imagem de capa, avatar e métricas principais.
 */
export function SellerHero({ seller, className }: SellerHeroProps) {
  const initials = seller.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-card",
        className,
      )}
    >
      {/* Cover */}
      <div className="relative h-40 w-full md:h-56">
        {seller.coverImage ? (
          <img
            src={seller.coverImage}
            alt=""
            aria-hidden
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-hero" />
        )}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, transparent 30%, color-mix(in oklab, var(--card) 92%, transparent) 100%)",
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-60 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, color-mix(in oklab, var(--primary) 35%, transparent), transparent 70%)",
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative -mt-14 flex flex-col gap-5 p-5 md:-mt-16 md:flex-row md:items-end md:gap-6 md:p-8"
      >
        <Avatar className="h-24 w-24 shrink-0 border-4 border-card shadow-elegant md:h-28 md:w-28">
          {seller.avatarUrl && (
            <AvatarImage src={seller.avatarUrl} alt={seller.name} />
          )}
          <AvatarFallback className="bg-surface text-xl font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              {seller.name}
            </h1>
            {seller.verified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
                <BadgeCheck className="h-3.5 w-3.5" /> Verificado
              </span>
            )}
            {seller.level && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                Nível {seller.level}
              </span>
            )}
          </div>

          {seller.description && (
            <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
              {seller.description}
            </p>
          )}

          <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <Metric
              icon={Star}
              value={`${seller.rating.toFixed(1)} / 5.0`}
              label="Avaliação média"
            />
            <Metric
              icon={TrendingUp}
              value={
                seller.stats
                  ? formatCompact(seller.stats.totalSales)
                  : seller.salesCount
                    ? formatCompact(seller.salesCount)
                    : "—"
              }
              label="Vendas realizadas"
            />
            <Metric
              icon={Package}
              value={
                seller.stats
                  ? formatCompact(seller.stats.activeProducts)
                  : "—"
              }
              label="Produtos ativos"
            />
            <Metric
              icon={Clock}
              value={seller.responseTime ?? seller.stats?.responseTime ?? "—"}
              label="Tempo de resposta"
            />
            {seller.memberSince && (
              <Metric
                icon={CalendarDays}
                value={new Date(seller.memberSince).toLocaleDateString("pt-BR", {
                  month: "short",
                  year: "numeric",
                })}
                label="Membro desde"
              />
            )}
          </dl>
        </div>
      </motion.div>
    </section>
  );
}

function Metric({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Star;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-primary" />
      <div>
        <div className="text-sm font-semibold text-foreground">{value}</div>
        <div className="text-[11px] uppercase tracking-wide">{label}</div>
      </div>
    </div>
  );
}
