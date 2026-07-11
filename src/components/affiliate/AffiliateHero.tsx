import { Users, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function AffiliateHero() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-accent/10 to-transparent p-8 md:p-12">
      <div className="max-w-2xl space-y-4">
        <Badge variant="secondary" className="gap-1">
          <Users className="h-3 w-3" /> Afiliados LIT Buy
        </Badge>
        <h1 className="text-3xl font-bold text-foreground md:text-4xl">
          Indique. Cresça. Ganhe.
        </h1>
        <p className="text-muted-foreground">
          Convide compradores e vendedores para a LIT Buy e acumule comissão
          demonstrativa. Programa próprio, integrado ao ecossistema LIT.
        </p>
        <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Sparkles className="h-3 w-3" /> Comissões, saques e tracking reais
          exigirão backend, antifraude e auditoria.
        </p>
      </div>
    </section>
  );
}
