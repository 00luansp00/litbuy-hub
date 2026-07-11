import { Package, Truck, Zap, Sparkles, Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Product } from "@/types";

interface ProductDetailsSpecsProps {
  product: Product;
}

const MODEL_LABEL: Record<string, string> = {
  normal: "Anúncio normal",
  dynamic: "Anúncio dinâmico",
  service: "Serviço",
};

const PRODUCT_TYPE_LABEL: Record<string, string> = {
  account: "Conta",
  virtual_currency: "Moeda virtual",
  gift_card: "Gift card",
  key: "Chave / Key",
  skin: "Skin",
  item: "Item",
  service: "Serviço",
  subscription: "Assinatura",
  game: "Jogo",
  software: "Software",
  other: "Outro",
};

const TIER_LABEL: Record<string, string> = {
  silver: "Prata",
  gold: "Ouro",
  diamond: "Diamante",
};

/**
 * ProductDetailsSpecs — resumo estruturado das características do anúncio.
 * Consolida modelo, tipo, categoria, subcategoria, entrega, planos e atributos.
 */
export function ProductDetailsSpecs({ product }: ProductDetailsSpecsProps) {
  const rows: { label: string; value: React.ReactNode }[] = [];
  if (product.listingModel) {
    rows.push({ label: "Modelo", value: MODEL_LABEL[product.listingModel] ?? product.listingModel });
  }
  if (product.productType) {
    rows.push({
      label: "Tipo",
      value: PRODUCT_TYPE_LABEL[product.productType] ?? product.productType,
    });
  }
  rows.push({ label: "Categoria", value: product.categoryName });
  if (product.subcategoryName) {
    rows.push({ label: "Subcategoria", value: product.subcategoryName });
  }
  if (product.deliveryMode) {
    rows.push({
      label: "Entrega",
      value: (
        <Badge variant="secondary" className="gap-1 text-[10px]">
          {product.deliveryMode === "automatic" ? (
            <>
              <Zap className="h-3 w-3 text-warning" /> Automática
            </>
          ) : (
            <>
              <Truck className="h-3 w-3 text-primary" /> Manual
            </>
          )}
        </Badge>
      ),
    });
  }
  if (product.stock !== undefined) {
    rows.push({
      label: "Estoque",
      value: `${Math.max(0, product.stock)} unidade(s)`,
    });
  }

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Características do anúncio
          </h3>
        </div>
        <div className="flex gap-1">
          {product.promotionTier && (
            <Badge variant="outline" className="gap-1 text-[10px]">
              <Sparkles className="h-3 w-3 text-warning" />
              {TIER_LABEL[product.promotionTier]}
            </Badge>
          )}
          {product.sellerPlan === "lit_max" && (
            <Badge className="gap-1 bg-gradient-to-r from-primary to-accent text-[10px] text-primary-foreground">
              <Crown className="h-3 w-3" /> LIT-MAX
            </Badge>
          )}
        </div>
      </header>

      <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between rounded-lg bg-surface/60 px-3 py-2"
          >
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="text-right font-semibold text-foreground">{r.value}</dd>
          </div>
        ))}
      </dl>

      {product.attributes && product.attributes.length > 0 && (
        <div>
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Atributos
          </div>
          <ul className="flex flex-wrap gap-1.5">
            {product.attributes.map((a) => (
              <li key={a.key}>
                <Badge variant="secondary" className="text-[10px]">
                  <span className="text-muted-foreground">{a.key}:</span>{" "}
                  <span className="ml-1 text-foreground">{a.value}</span>
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
