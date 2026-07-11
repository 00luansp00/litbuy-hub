import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { BadgeCheck, ExternalLink, PackagePlus, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Seller } from "@/types";

interface SellerDashboardHeaderProps {
  seller: Seller;
}

export function SellerDashboardHeader({ seller }: SellerDashboardHeaderProps) {
  const initials = seller.name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const activeProducts = seller.stats?.activeProducts ?? 0;
  const totalSales = seller.stats?.totalSales ?? seller.salesCount ?? 0;

  return (
    <motion.header
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl border border-border bg-card p-5 shadow-card md:p-6"
    >
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <Avatar className="h-16 w-16 shrink-0 border border-border">
            <AvatarImage src={seller.avatarUrl} alt={seller.name} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-bold tracking-tight text-foreground md:text-2xl">
                {seller.name}
              </h1>
              {seller.verified && (
                <Badge variant="secondary" className="gap-1">
                  <BadgeCheck className="h-3.5 w-3.5 text-success" /> Verificado
                </Badge>
              )}
              {seller.level && (
                <Badge variant="outline" className="text-xs">
                  {seller.level}
                </Badge>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground md:text-sm">
              <span className="inline-flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                {seller.rating.toFixed(1)}
              </span>
              <span>{totalSales.toLocaleString("pt-BR")} vendas</span>
              <span>{activeProducts} produtos ativos</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {seller.slug && (
            <Button asChild variant="outline">
              <Link to="/loja/$slug" params={{ slug: seller.slug }}>
                <ExternalLink className="mr-2 h-4 w-4" /> Ver loja pública
              </Link>
            </Button>
          )}
          <Button asChild>
            <Link to="/vendedor/anuncios/novo">
              <PackagePlus className="mr-2 h-4 w-4" /> Criar anúncio
            </Link>
          </Button>
        </div>
      </div>
    </motion.header>
  );
}
