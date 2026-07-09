import { Globe2, Sparkles, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Seller } from "@/types";

interface SellerAboutProps {
  seller: Seller;
  className?: string;
}

/**
 * SellerAbout — bloco textual com descrição, especialidades e idiomas.
 */
export function SellerAbout({ seller, className }: SellerAboutProps) {
  const hasSpecialties = (seller.specialties?.length ?? 0) > 0;
  const hasLanguages = (seller.languages?.length ?? 0) > 0;

  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card p-5 md:p-6",
        className,
      )}
      aria-label={`Sobre ${seller.name}`}
    >
      <h2 className="mb-4 text-lg font-semibold text-foreground">Sobre a loja</h2>

      {seller.description && (
        <p className="text-sm leading-relaxed text-muted-foreground">
          {seller.description}
        </p>
      )}

      {hasSpecialties && (
        <div className="mt-5">
          <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Especialidades
          </h3>
          <div className="flex flex-wrap gap-2">
            {seller.specialties!.map((s) => (
              <Badge key={s} variant="secondary" className="rounded-full">
                {s}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {hasLanguages && (
        <div className="mt-5">
          <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Globe2 className="h-3.5 w-3.5 text-accent" />
            Idiomas
          </h3>
          <div className="flex flex-wrap gap-2">
            {seller.languages!.map((lang) => (
              <span
                key={lang}
                className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs text-foreground"
              >
                {lang}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex items-start gap-2 rounded-lg border border-border bg-surface/60 p-3 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
        <p>
          Todas as compras são protegidas pela garantia da LIT Buy. Nunca combine
          pagamentos fora da plataforma.
        </p>
      </div>
    </section>
  );
}
