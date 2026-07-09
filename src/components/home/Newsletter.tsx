import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function Newsletter() {
  return (
    <section className="container-lit py-12 md:py-16">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 md:p-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{ backgroundImage: "var(--gradient-hero)" }}
        />
        <div className="relative grid gap-6 md:grid-cols-2 md:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Mail className="h-3.5 w-3.5 text-primary" /> Newsletter
            </span>
            <h3 className="mt-3 text-2xl md:text-3xl font-bold tracking-tight">
              Ofertas exclusivas na sua caixa de entrada.
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Receba drops, promoções relâmpago e novidades antes de todo mundo.
            </p>
          </div>
          <form
            className="flex flex-col sm:flex-row gap-3"
            onSubmit={(e) => e.preventDefault()}
          >
            <Input
              type="email"
              required
              placeholder="seu@email.com"
              className="h-11 bg-surface border-border"
            />
            <Button type="submit" size="lg" className="whitespace-nowrap">
              Inscrever-se
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}
