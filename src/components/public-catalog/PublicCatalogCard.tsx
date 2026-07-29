import { useState } from "react";
import { ImageOff } from "lucide-react";
import type { PublicCatalogCard as CatalogCard } from "@/services/publicCatalog";
import { formatPublicCatalogPrice } from "./formatPublicCatalogPrice";

const productTypeLabels: Record<CatalogCard["productType"], string> = {
  ACCOUNT: "Conta",
  VIRTUAL_CURRENCY: "Moeda virtual",
  GIFT_CARD: "Gift card",
  KEY: "Chave",
  SKIN: "Skin",
  ITEM: "Item",
  SERVICE: "Serviço",
  SUBSCRIPTION: "Assinatura",
  GAME: "Jogo",
  SOFTWARE: "Software",
  OTHER: "Outro",
};
const modelLabels: Record<CatalogCard["model"], string> = {
  NORMAL: "Normal",
  DYNAMIC: "Dinâmico",
  SERVICE: "Serviço",
};

export function PublicCatalogCard({ product }: { product: CatalogCard }) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const imageFailed = failedImageUrl === product.coverImage.url;
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-transform duration-200 hover:-translate-y-1">
      <div className="aspect-[4/3] overflow-hidden bg-gradient-to-br from-primary/10 via-muted to-accent/20">
        {imageFailed ? (
          <div
            className="flex h-full items-center justify-center text-muted-foreground"
            role="img"
            aria-label={`Imagem indisponível: ${product.title}`}
          >
            <ImageOff className="h-10 w-10" aria-hidden="true" />
          </div>
        ) : (
          <img
            src={product.coverImage.url}
            alt={product.coverImage.altText ?? product.title}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => setFailedImageUrl(product.coverImage.url)}
          />
        )}
      </div>
      <div className="space-y-3 p-5">
        <div className="flex flex-wrap gap-2 text-xs font-medium text-muted-foreground">
          <span>{product.category.name}</span>
          {product.subcategory && (
            <>
              <span aria-hidden="true">•</span>
              <span>{product.subcategory.name}</span>
            </>
          )}
        </div>
        <h3 className="line-clamp-2 text-lg font-semibold text-foreground">{product.title}</h3>
        <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
          {product.shortDescription}
        </p>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-muted px-2.5 py-1">
            {productTypeLabels[product.productType]}
          </span>
          <span className="rounded-full bg-muted px-2.5 py-1">{modelLabels[product.model]}</span>
          {product.stock !== null && (
            <span className="rounded-full bg-muted px-2.5 py-1">Estoque: {product.stock}</span>
          )}
        </div>
        <div className="border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">Loja {product.seller.storeName}</p>
          <p className="mt-1 text-lg font-bold text-primary">
            {formatPublicCatalogPrice(product.pricing)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Visualização do catálogo · detalhes em breve
          </p>
        </div>
      </div>
    </article>
  );
}
