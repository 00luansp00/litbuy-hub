import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  PRODUCT_IMAGE_LIMIT,
  productImageService,
  type ProductImage,
  validateProductImage,
} from "@/services/productImageService";
export function ProductImageManager({ productId }: { productId: string }) {
  const [images, setImages] = useState<ProductImage[]>([]);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const previews = useRef<string[]>([]);
  const load = () =>
    productImageService
      .list(productId)
      .then((x) => setImages(x.items))
      .catch(() => setError("Não foi possível carregar as imagens."));
  useEffect(() => {
    load();
    return () => previews.current.forEach(URL.revokeObjectURL);
  }, [productId]);
  const upload = async (file?: File) => {
    if (!file) return;
    setError("");
    try {
      validateProductImage(file, images.length);
      const preview = URL.createObjectURL(file);
      previews.current.push(preview);
      setProgress(0);
      await productImageService.upload(productId, file, setProgress);
      URL.revokeObjectURL(preview);
      previews.current = previews.current.filter((x) => x !== preview);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress(null);
    }
  };
  const reorder = async (index: number, delta: number) => {
    const next = [...images];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    setImages(next);
    await productImageService.reorder(
      productId,
      next.map((x) => x.id),
    );
  };
  return (
    <section className="mt-4 rounded-xl border p-4" aria-label="Imagens do produto">
      <h3 className="font-semibold">
        Imagens do produto ({images.length}/{PRODUCT_IMAGE_LIMIT})
      </h3>
      <input
        className="mt-3"
        aria-label="Selecionar imagens"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={images.length >= PRODUCT_IMAGE_LIMIT}
        onChange={(e) => void upload(e.target.files?.[0])}
      />
      {progress !== null && <p>Enviando: {progress}%</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {images.map((image, index) => (
          <div className="rounded border p-2" key={image.id}>
            {image.viewUrl ? (
              <img
                className="h-28 w-full object-cover"
                src={image.viewUrl}
                alt={image.altText ?? "Imagem do produto"}
              />
            ) : (
              <p>Upload pendente</p>
            )}
            <div className="mt-2 flex flex-wrap gap-1">
              {image.isCover ? (
                <span className="text-sm">Capa</span>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void productImageService.cover(productId, image.id).then(load)}
                >
                  Definir capa
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => void reorder(index, -1)}>
                ←
              </Button>
              <Button size="sm" variant="outline" onClick={() => void reorder(index, 1)}>
                →
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() =>
                  void productImageService
                    .remove(productId, image.id)
                    .then(load)
                    .catch(() => setError("Exclusão pendente; tente novamente."))
                }
              >
                Excluir
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
