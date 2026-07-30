import { useState } from "react";
import { ImageOff } from "lucide-react";
import type { PublicCatalogProductDetail } from "@/services/publicCatalog";

export function PublicProductDetailGallery({ product }: { product: PublicCatalogProductDetail }) {
  const coverIndex = Math.max(
    0,
    product.gallery.findIndex((image) => image.isCover),
  );
  const [selected, setSelected] = useState(coverIndex);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const image = product.gallery[selected] ?? product.gallery[coverIndex];
  const failed = failedUrl === image.url;
  return (
    <section aria-label="Galeria do produto" className="space-y-3">
      <div className="aspect-square overflow-hidden rounded-2xl border bg-muted">
        {failed ? (
          <div
            className="flex h-full items-center justify-center text-muted-foreground"
            role="img"
            aria-label="Imagem indisponível"
          >
            <ImageOff className="h-12 w-12" aria-hidden="true" />
          </div>
        ) : (
          <img
            src={image.url}
            alt={image.altText ?? product.title}
            className="h-full w-full object-cover"
            onError={() => setFailedUrl(image.url)}
          />
        )}
      </div>
      {product.gallery.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {product.gallery.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelected(index)}
              aria-label={`Exibir imagem ${index + 1} de ${product.title}`}
              aria-pressed={selected === index}
              className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border-2 border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <img
                src={item.url}
                alt={item.altText ?? product.title}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
