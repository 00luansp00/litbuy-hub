import { cn } from "@/lib/utils";

interface ProductDescriptionProps {
  /** Texto plano por enquanto. Preparado para HTML/Markdown no futuro. */
  content?: string;
  className?: string;
}

/**
 * ProductDescription — bloco de descrição longa.
 * Renderiza texto plano hoje; a mesma API aceita HTML sanitizado futuramente.
 */
export function ProductDescription({ content, className }: ProductDescriptionProps) {
  const paragraphs = (content ?? "").split(/\n{2,}/).filter(Boolean);
  const body =
    paragraphs.length > 0
      ? paragraphs
      : [
          "Este anúncio ainda não possui uma descrição detalhada. Assim que o vendedor atualizar as informações, elas aparecerão aqui automaticamente.",
        ];

  return (
    <section className={cn("rounded-2xl border border-border bg-card p-5 md:p-6", className)}>
      <h2 className="mb-4 text-lg font-semibold text-foreground">Descrição</h2>
      <div className="prose-invert space-y-3 text-sm leading-relaxed text-muted-foreground md:text-base">
        {body.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </section>
  );
}
