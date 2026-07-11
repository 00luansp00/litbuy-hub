import { useState } from "react";
import { motion } from "motion/react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Ban,
  Heart,
  Minus,
  PackageX,
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
import { useCart } from "@/providers/CartProvider";
import { useAuth } from "@/providers/AuthProvider";
import { getUnavailabilityReason } from "@/services/productService";
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
  const unavailability = getUnavailabilityReason(product);
  const isAvailable = !unavailability;
  const maxQty = Math.max(
    1,
    Math.min(99, product.stock !== undefined ? product.stock : 99),
  );
  const [qty, setQty] = useState(1);
  const { addItem } = useCart();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleAddToCart = () => {
    if (unavailability) {
      toast.error(unavailability.toast);
      return;
    }
    addItem(product, qty);
    toast.success("Adicionado ao carrinho", {
      description: `${qty}x ${product.title}`,
    });
  };

  const handleBuyNow = () => {
    if (unavailability) {
      toast.error(unavailability.toast);
      return;
    }
    addItem(product, qty);
    if (!isAuthenticated) {
      toast.info("Faça login para finalizar a compra");
      navigate({ to: "/login" });
      return;
    }
    navigate({ to: "/checkout" });
  };


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

      {/* Aviso de indisponibilidade */}
      {unavailability && (
        <div
          className={cn(
            "flex items-start gap-2 rounded-xl border p-3 text-xs",
            unavailability.kind === "sold_out"
              ? "border-destructive/40 bg-destructive/5 text-destructive"
              : "border-warning/40 bg-warning/5 text-warning",
          )}
        >
          {unavailability.kind === "sold_out" ? (
            <PackageX className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <Ban className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <p className="font-medium">
            {unavailability.kind === "sold_out"
              ? "Produto esgotado"
              : "Produto indisponível"}
          </p>
        </div>
      )}

      {/* Quantidade */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Quantidade</span>
        <div className="inline-flex items-center rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            aria-label="Diminuir"
            disabled={!isAvailable}
            className="grid h-9 w-9 place-items-center text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-8 text-center text-sm font-medium">{qty}</span>
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
            aria-label="Aumentar"
            disabled={!isAvailable || qty >= maxQty}
            className="grid h-9 w-9 place-items-center text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Button
          size="lg"
          className="w-full"
          onClick={handleBuyNow}
          disabled={!isAvailable}
        >
          <Zap className="mr-2 h-4 w-4" /> Comprar agora
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className="w-full"
          onClick={handleAddToCart}
          disabled={!isAvailable}
        >
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
