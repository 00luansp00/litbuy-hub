import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, ImagePlus, Loader2, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * ImageUploader — componente visual/mockado de upload de imagens.
 *
 * IMPORTANTE:
 * - Não faz upload real.
 * - Não envia arquivos para servidor / Storage.
 * - Não persiste nada.
 * - Usa a File API APENAS para gerar previews locais (URL.createObjectURL).
 * - Simula ~2s de progresso para transmitir a sensação de upload.
 *
 * Substituível no futuro por um uploader real sem alterar a UI consumidora.
 */

export interface ImageUploaderItem {
  /** ID local, apenas para keys/remoção — não corresponde a nada no backend. */
  id: string;
  name: string;
  size: number;
  /** Object URL do preview local (revogado ao remover/desmontar). */
  previewUrl: string;
}

interface ImageUploaderProps {
  value?: ImageUploaderItem[];
  onChange?: (items: ImageUploaderItem[]) => void;
  /** Máximo de imagens permitidas (visual). */
  maxImages?: number;
  /** Tamanho máximo visual por arquivo em MB (default 8). */
  maxSizeMB?: number;
  className?: string;
}

const genId = () =>
  `img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function ImageUploader({
  value,
  onChange,
  maxImages = 6,
  maxSizeMB = 8,
  className,
}: ImageUploaderProps) {
  const [internal, setInternal] = useState<ImageUploaderItem[]>([]);
  const items = value ?? internal;

  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const setItems = useCallback(
    (next: ImageUploaderItem[]) => {
      if (onChange) onChange(next);
      else setInternal(next);
    },
    [onChange],
  );

  // Revoga object URLs ao desmontar para evitar vazamentos.
  useEffect(() => {
    return () => {
      items.forEach((i) => {
        try {
          URL.revokeObjectURL(i.previewUrl);
        } catch {
          /* noop */
        }
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remaining = Math.max(0, maxImages - items.length);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      setError(null);
      const list = Array.from(files);

      // Filtra apenas imagens.
      const images = list.filter((f) => f.type.startsWith("image/"));
      if (images.length === 0) {
        setError("Selecione arquivos de imagem (JPG, PNG, WEBP).");
        return;
      }

      // Valida tamanho.
      const maxBytes = maxSizeMB * 1024 * 1024;
      const tooBig = images.find((f) => f.size > maxBytes);
      if (tooBig) {
        setError(`Cada imagem deve ter até ${maxSizeMB} MB.`);
        return;
      }

      // Limita quantidade.
      if (images.length > remaining) {
        setError(
          `Você pode adicionar até ${maxImages} imagens. Restam ${remaining}.`,
        );
        return;
      }

      // Simula progresso ~2s.
      setUploading(true);
      setProgress(0);
      const started = Date.now();
      const duration = 1800;
      const tick = () => {
        const elapsed = Date.now() - started;
        const pct = Math.min(100, Math.round((elapsed / duration) * 100));
        setProgress(pct);
        if (pct < 100) {
          requestAnimationFrame(tick);
        } else {
          const newItems: ImageUploaderItem[] = images.map((f) => ({
            id: genId(),
            name: f.name,
            size: f.size,
            previewUrl: URL.createObjectURL(f),
          }));
          setItems([...items, ...newItems]);
          setUploading(false);
          setProgress(0);
          toast.success(
            newItems.length === 1
              ? "Imagem adicionada (demo)"
              : `${newItems.length} imagens adicionadas (demo)`,
            { description: "Nenhum arquivo foi enviado ao servidor." },
          );
        }
      };
      requestAnimationFrame(tick);
    },
    [items, maxImages, maxSizeMB, remaining, setItems],
  );

  const openPicker = () => inputRef.current?.click();

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    // Reseta para permitir escolher o mesmo arquivo novamente.
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const removeItem = (id: string) => {
    const target = items.find((i) => i.id === id);
    if (target) {
      try {
        URL.revokeObjectURL(target.previewUrl);
      } catch {
        /* noop */
      }
    }
    setItems(items.filter((i) => i.id !== id));
    setError(null);
  };

  const isFull = items.length >= maxImages;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!isFull && !uploading) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={cn(
          "relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-6 text-center transition-colors sm:p-8",
          isDragging && !isFull
            ? "border-primary bg-primary/5"
            : "border-border bg-surface/40",
          (isFull || uploading) && "opacity-70",
        )}
      >
        <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <UploadCloud className="h-6 w-6" />
          )}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            {uploading
              ? "Enviando imagens (demo)..."
              : isFull
                ? "Limite de imagens atingido"
                : "Arraste imagens aqui ou selecione do dispositivo"}
          </p>
          <p className="text-xs text-muted-foreground">
            Até {maxImages} imagens • JPG, PNG ou WEBP • máx {maxSizeMB} MB cada
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={openPicker}
            disabled={isFull || uploading}
          >
            <ImagePlus className="mr-2 h-4 w-4" /> Selecionar imagens
          </Button>
          <span className="text-[11px] text-muted-foreground">
            {items.length}/{maxImages} adicionadas
          </span>
        </div>

        {uploading && (
          <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={onInputChange}
        />
      </div>

      {/* Erro */}
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Thumbnails */}
      {items.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          <AnimatePresence initial={false}>
            {items.map((it, index) => (
              <motion.div
                key={it.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-surface"
              >
                <img
                  src={it.previewUrl}
                  alt={it.name}
                  className="h-full w-full object-cover"
                />
                {index === 0 && (
                  <span className="absolute left-2 top-2 rounded-md bg-primary/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                    Capa
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeItem(it.id)}
                  aria-label={`Remover ${it.name}`}
                  className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-background/80 text-foreground opacity-0 backdrop-blur transition-opacity hover:bg-destructive hover:text-destructive-foreground group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-[10px] text-white/90">
                  <div className="truncate">{it.name}</div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface/40 p-4 text-center text-xs text-muted-foreground">
          Nenhuma imagem adicionada. Comece pela imagem que servirá de capa do
          anúncio — ela é a primeira que o comprador vê.
        </div>
      )}
    </div>
  );
}
