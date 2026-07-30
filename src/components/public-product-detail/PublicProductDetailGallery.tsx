import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import type { PublicCatalogProductDetail } from "@/services/publicCatalog";

export function PublicProductDetailGallery({ product }: { product: PublicCatalogProductDetail }) {
  const coverIndex = Math.max(
    0,
    product.gallery.findIndex((image) => image.isCover),
  );
  const [selectedId, setSelectedId] = useState(product.gallery[coverIndex]?.id);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [failedThumbnailUrls, setFailedThumbnailUrls] = useState<Set<string>>(() => new Set());
  const selected = product.gallery.findIndex((item) => item.id === selectedId);
  const image = product.gallery[selected >= 0 ? selected : coverIndex];
  const failed = failedUrl === image.url;
  useEffect(() => {
    setSelectedId(product.gallery[coverIndex]?.id);
    setFailedUrl(null);
    setFailedThumbnailUrls(new Set());
  }, [coverIndex, product.gallery, product.id]);
  useEffect(() => {
    if (!product.gallery.some((item) => item.id === selectedId)) {
      setSelectedId(product.gallery[coverIndex]?.id);
    }
  }, [coverIndex, product.gallery, selectedId]);
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
              onClick={() => setSelectedId(item.id)}
              aria-label={`Exibir imagem ${index + 1} de ${product.title}`}
              aria-pressed={image.id === item.id}
              className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border-2 border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {failedThumbnailUrls.has(item.url) ? (
                <span
                  className="flex h-full items-center justify-center text-muted-foreground"
                  role="img"
                  aria-label={`Miniatura indisponível: ${item.altText ?? product.title}`}
                >
                  <ImageOff className="h-5 w-5" aria-hidden="true" />
                </span>
              ) : (
                <img
                  src={item.url}
                  alt={item.altText ?? product.title}
                  className="h-full w-full object-cover"
                  onError={() =>
                    setFailedThumbnailUrls((current) => new Set(current).add(item.url))
                  }
                />
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
