import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { toast } from "sonner";
import {
  Copy,
  Edit3,
  Eye,
  MoreHorizontal,
  Pause,
  Play,
  Star,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SellerListing, SellerListingStatus } from "@/types";

const STATUS_LABEL: Record<SellerListingStatus, string> = {
  active: "Ativo",
  paused: "Pausado",
  in_review: "Em análise",
  rejected: "Recusado",
  sold: "Vendido",
};

const STATUS_TONE: Record<SellerListingStatus, string> = {
  active: "bg-success/15 text-success border-success/30",
  paused: "bg-muted text-muted-foreground border-border",
  in_review: "bg-primary/15 text-primary border-primary/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  sold: "bg-accent/15 text-accent border-accent/30",
};

interface SellerListingsTableProps {
  listings: SellerListing[];
}

export function SellerListingsTable({ listings }: SellerListingsTableProps) {
  const soon = (label: string) =>
    toast("Em breve", { description: `A ação "${label}" será liberada com backend.` });

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      {/* Header desktop */}
      <div className="hidden grid-cols-[minmax(0,3fr)_1fr_1fr_1fr_1fr_auto] items-center gap-3 border-b border-border bg-surface/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:grid">
        <span>Anúncio</span>
        <span>Preço</span>
        <span>Estoque</span>
        <span>Vendas</span>
        <span>Views</span>
        <span className="text-right">Ações</span>
      </div>

      <ul className="divide-y divide-border">
        {listings.map((l, i) => (
          <motion.li
            key={l.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.02 }}
            className="grid grid-cols-1 gap-3 px-4 py-3 md:grid-cols-[minmax(0,3fr)_1fr_1fr_1fr_1fr_auto] md:items-center"
          >
            <div className="flex gap-3 min-w-0">
              <Link
                to="/produto/$id"
                params={{ id: l.slug }}
                className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-surface"
              >
                <img
                  src={l.image}
                  alt={l.title}
                  className="h-full w-full object-cover"
                />
              </Link>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="truncate">{l.categoryName}</span>
                  {l.instantDelivery && (
                    <Badge variant="secondary" className="gap-1 text-[10px]">
                      <Zap className="h-3 w-3" /> Instantâneo
                    </Badge>
                  )}
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-1.5 py-px text-[10px] font-medium",
                      STATUS_TONE[l.status],
                    )}
                  >
                    {STATUS_LABEL[l.status]}
                  </span>
                </div>
                <Link
                  to="/produto/$id"
                  params={{ id: l.slug }}
                  className="mt-0.5 line-clamp-1 text-sm font-medium text-foreground hover:text-primary"
                >
                  {l.title}
                </Link>
                <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Star className="h-3 w-3 fill-warning text-warning" />
                  {l.rating.toFixed(1)}
                </div>
              </div>
            </div>

            <div className="text-sm font-semibold text-foreground md:text-base">
              <span className="text-[11px] uppercase text-muted-foreground md:hidden">
                Preço:{" "}
              </span>
              {formatBRL(l.price)}
            </div>
            <div className="text-sm text-foreground">
              <span className="text-[11px] uppercase text-muted-foreground md:hidden">
                Estoque:{" "}
              </span>
              {l.stock}
            </div>
            <div className="text-sm text-foreground">
              <span className="text-[11px] uppercase text-muted-foreground md:hidden">
                Vendas:{" "}
              </span>
              {l.sales}
            </div>
            <div className="text-sm text-muted-foreground">
              <span className="text-[11px] uppercase text-muted-foreground md:hidden">
                Views:{" "}
              </span>
              {l.views.toLocaleString("pt-BR")}
            </div>

            <div className="flex flex-wrap justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Editar"
                onClick={() => soon("Editar")}
              >
                <Edit3 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={l.status === "paused" ? "Retomar" : "Pausar"}
                onClick={() => soon(l.status === "paused" ? "Retomar" : "Pausar")}
              >
                {l.status === "paused" ? (
                  <Play className="h-4 w-4" />
                ) : (
                  <Pause className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Duplicar"
                onClick={() => soon("Duplicar")}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button asChild variant="ghost" size="icon" aria-label="Ver anúncio">
                <Link to="/produto/$id" params={{ id: l.slug }}>
                  <Eye className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Mais"
                onClick={() => soon("Mais ações")}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
