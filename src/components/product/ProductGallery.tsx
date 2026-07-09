import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

interface ProductGalleryProps {
  images: string[];
  alt: string;
  className?: string;
}

/**
 * ProductGallery — miniaturas + imagem principal com zoom visual (sem lib externa).
 * O zoom move a `background-position` conforme o mouse.
 */
export function ProductGallery({ images, alt, className }: ProductGalleryProps) {
  const gallery = images.length > 0 ? images : [""];
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const src = gallery[active];

  return (
    <div className={cn("flex flex-col-reverse gap-3 md:flex-row", className)}>
      {/* Miniaturas */}
      {gallery.length > 1 && (
        <div className="flex gap-2 md:flex-col">
          {gallery.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Ver imagem ${i + 1}`}
              className={cn(
                "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-surface transition-all",
                i === active
                  ? "border-primary shadow-elegant"
                  : "border-border hover:border-primary/50",
              )}
            >
              <img src={img} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Imagem principal */}
      <div
        className="relative aspect-square flex-1 overflow-hidden rounded-2xl border border-border bg-surface"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setPos({
            x: ((e.clientX - rect.left) / rect.width) * 100,
            y: ((e.clientY - rect.top) / rect.height) * 100,
          });
        }}
        onMouseLeave={() => setPos(null)}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 bg-cover bg-center transition-[background-size,background-position] duration-200"
            style={{
              backgroundImage: `url(${src})`,
              backgroundSize: pos ? "180%" : "100%",
              backgroundPosition: pos ? `${pos.x}% ${pos.y}%` : "center",
            }}
            role="img"
            aria-label={alt}
          />
        </AnimatePresence>
      </div>
    </div>
  );
}
