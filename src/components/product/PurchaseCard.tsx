import { useState } from "react";
import { motion } from "motion/react";
import {
  Heart,
  Minus,
  Plus,
  Share2,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Wallet,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";

interface PurchaseCardProps {
  product: Product;
  className?: string;
}

/**
 * PurchaseCard — bloco lateral sticky de conversão.
 * 100% visual — nenhum evento dispara compra, carrinho ou favorito real.
 */
export function PurchaseCard({ product, className }: PurchaseCardProps) {
  const [qty, setQty] = useState(1);
  const maxQty = product.stock ?? 99;

  return (
    <motion.aside
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-card",
        className,
      )}
    >
      <div className="space-y-1">
        {product.originalPrice && (
          <div className="text-xs text-muted-foreground line-through">
            {formatBRL(product.originalPrice)}
          </div>
        )}
        <div className="text-3xl font-bold text-foreground">
          {formatBRL(product.price)}
        </div>
        <p className="text-xs text-muted-foreground">
          ou 12x de {formatBRL(product.price / 12)} sem juros
        </p>
      </div>

      {/* Quantidade */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Quantidade</span>
        <div className="inline-flex items-center rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            aria-label="Diminuir"
            className="grid h-9 w-9 place-items-center text-muted-foreground hover:text-foreground"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-8 text-center text-sm font-medium">{qty}</span>
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
            aria-label="Aumentar"
            className="grid h-9 w-9 place-items-center text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Button size="lg" className="w-full">
          <Zap className="mr-2 h-4 w-4" /> Comprar agora
        </Button>
        <Button size="lg" variant="secondary" className="w-full">
          <ShoppingCart className="mr-2 h-4 w-4" /> Adicionar ao carrinho
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm">
            <Heart className="mr-2 h-4 w-4" /> Favoritar
          </Button>
          <Button variant="outline" size="sm">
            <Share2 className="mr-2 h-4 w-4" /> Compartilhar
          </Button>
        </div>
      </div>

      <Separator />

      <ul className="space-y-2.5 text-xs text-muted-foreground">
        <TrustRow icon={ShieldCheck} tone="text-success">
          Garantia da plataforma LIT Buy
        </TrustRow>
        <TrustRow icon={Wallet} tone="text-accent">
          Pagamento 100% protegido
        </TrustRow>
        {product.instantDelivery ? (
          <TrustRow icon={Zap} tone="text-warning">
            Entrega instantânea após a confirmação
          </TrustRow>
        ) : (
          <TrustRow icon={Truck} tone="text-primary">
            Entrega em até 24 horas
          </TrustRow>
        )}
      </ul>
    </motion.aside>
  );
}

function TrustRow({
  icon: Icon,
  tone,
  children,
}: {
  icon: typeof ShieldCheck;
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2">
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone)} />
      <span>{children}</span>
    </li>
  );
}
