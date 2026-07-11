import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { ArrowLeft, PackageSearch, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyCheckoutState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center"
    >
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-surface text-muted-foreground">
        <PackageSearch className="h-8 w-8" />
      </span>
      <div className="space-y-1.5">
        <h2 className="text-xl font-bold text-foreground">Seu checkout está vazio</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Adicione produtos ao carrinho para finalizar uma compra. Nenhuma cobrança
          será feita nesta demonstração.
        </p>
      </div>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <Button asChild variant="outline">
          <Link to="/carrinho">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao carrinho
          </Link>
        </Button>
        <Button asChild>
          <Link to="/">
            <Sparkles className="mr-2 h-4 w-4" /> Explorar produtos
          </Link>
        </Button>
      </div>
    </motion.div>
  );
}
