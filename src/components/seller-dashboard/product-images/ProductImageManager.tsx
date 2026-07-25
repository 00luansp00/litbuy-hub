import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PRODUCT_IMAGE_LIMIT,
  ProductImageConfirmationError,
  productImageService,
  type ProductImage,
  validateProductImage,
} from "@/services/productImageService";
type Pending = {
  preview: string;
  progress: number;
  imageId?: string;
  confirmationPending: boolean;
};
export function ProductImageManager({ productId }: { productId: string }) {
  const [images, setImages] = useState<ProductImage[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [altText, setAltText] = useState("");
  const currentPreview = useRef<string | null>(null);
  const load = useCallback(
    () =>
      productImageService
        .list(productId)
        .then((x) => setImages(x.items))
        .catch(() => setError("Não foi possível carregar as imagens.")),
    [productId],
  );
  const revoke = useCallback(() => {
    if (currentPreview.current) {
      URL.revokeObjectURL(currentPreview.current);
      currentPreview.current = null;
    }
  }, []);
  useEffect(() => {
    void load();
    return revoke;
  }, [load, revoke]);
  const upload = async (file?: File) => {
    if (!file) return;
    setError("");
    revoke();
    try {
      validateProductImage(file, images.length);
      const preview = URL.createObjectURL(file);
      currentPreview.current = preview;
      setPending({ preview, progress: 0, confirmationPending: false });
      await productImageService.upload(
        productId,
        file,
        (value) => setPending((old) => (old ? { ...old, progress: value } : old)),
        altText,
      );
      revoke();
      setPending(null);
      setAltText("");
      await load();
    } catch (e) {
      if (e instanceof ProductImageConfirmationError) {
        setPending((old) =>
          old ? { ...old, imageId: e.imageId, progress: 100, confirmationPending: true } : old,
        );
      } else {
        revoke();
        setPending(null);
      }
      setError((e as Error).message);
    }
  };
  const retryComplete = async () => {
    if (!pending?.imageId) return;
    setBusy(pending.imageId);
    try {
      await productImageService.complete(productId, pending.imageId);
      revoke();
      setPending(null);
      setError("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const reorder = async (index: number, delta: number) => {
    if (busy) return;
    const before = images;
    const next = [...before];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    setImages(next);
    setBusy("reorder");
    try {
      const result = await productImageService.reorder(
        productId,
        next.map((x) => x.id),
      );
      setImages(result.items);
    } catch {
      setImages(before);
      setError("Não foi possível reordenar; a ordem anterior foi restaurada.");
    } finally {
      setBusy(null);
    }
  };
  const cover = async (image: ProductImage) => {
    setBusy(image.id);
    try {
      await productImageService.cover(productId, image.id);
      await load();
    } catch {
      setError("Não foi possível definir a capa.");
    } finally {
      setBusy(null);
    }
  };
  const remove = async (image: ProductImage) => {
    setBusy(image.id);
    try {
      await productImageService.remove(productId, image.id);
      await load();
    } catch {
      setError("Exclusão pendente; tente novamente.");
    } finally {
      setBusy(null);
    }
  };
  return (
    <section className="mt-4 rounded-xl border p-4" aria-label="Imagens do produto">
      <h3 className="font-semibold">
        Imagens do produto ({images.length}/{PRODUCT_IMAGE_LIMIT})
      </h3>
      <Input
        className="mt-2"
        aria-label="Texto alternativo"
        value={altText}
        maxLength={300}
        placeholder="Texto alternativo (opcional)"
        onChange={(e) => setAltText(e.target.value)}
      />
      <input
        className="mt-3"
        aria-label="Selecionar imagens"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={images.length >= PRODUCT_IMAGE_LIMIT || !!busy || !!pending}
        onChange={(e) => void upload(e.target.files?.[0])}
      />
      {pending && (
        <div className="mt-3 rounded border p-2">
          <img className="h-28 w-full object-cover" src={pending.preview} alt="Preview local" />
          <p>
            {pending.confirmationPending
              ? "Arquivo enviado; confirmação pendente."
              : `Enviando: ${pending.progress}%`}
          </p>
          {pending.confirmationPending && (
            <Button disabled={busy === pending.imageId} onClick={() => void retryComplete()}>
              Tentar confirmar novamente
            </Button>
          )}
        </div>
      )}
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
                  disabled={!!busy}
                  onClick={() => void cover(image)}
                >
                  Definir capa
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={!!busy}
                onClick={() => void reorder(index, -1)}
              >
                ←
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!!busy}
                onClick={() => void reorder(index, 1)}
              >
                →
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={!!busy}
                onClick={() => void remove(image)}
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
