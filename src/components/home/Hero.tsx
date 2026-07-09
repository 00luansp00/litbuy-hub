import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { ArrowRight, ShieldCheck, Zap, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-hero">
      <div className="container-lit relative py-16 md:py-24 grid gap-10 lg:grid-cols-2 lg:items-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="space-y-6"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Novo marketplace premium para gamers
          </span>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
            Compre e venda com
            <br />
            <span className="text-gradient">segurança e velocidade.</span>
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-xl">
            Contas, gift cards, moedas, skins, itens e serviços — tudo em um só lugar,
            com pagamento protegido e entrega instantânea.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" asChild>
              <Link to="/">
                Explorar produtos <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/vendedor">Quero vender</Link>
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-success" /> Pagamento protegido
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-warning" /> Entrega instantânea
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          className="relative hidden lg:block"
        >
          <div
            className="absolute inset-0 -z-10 blur-3xl opacity-60"
            style={{ backgroundImage: "var(--gradient-primary)" }}
          />
          <div className="grid grid-cols-2 gap-4">
            {[
              { title: "Steam", meta: "R$ 100", tone: "from-primary" },
              { title: "Valorant", meta: "Skins", tone: "from-accent" },
              { title: "FIFA", meta: "500K FC", tone: "from-warning" },
              { title: "Xbox GP", meta: "3 meses", tone: "from-success" },
            ].map((c, i) => (
              <motion.div
                key={c.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.08, duration: 0.5 }}
                className="rounded-2xl border border-border bg-card p-5 shadow-card"
              >
                <div
                  className={`h-24 rounded-xl bg-gradient-to-br ${c.tone} to-transparent opacity-90 mb-4`}
                />
                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                  {c.meta}
                </div>
                <div className="text-lg font-semibold">{c.title}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
