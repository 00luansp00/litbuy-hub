import { motion } from "motion/react";
import { Megaphone, Users, ShoppingBag, Star } from "lucide-react";
import { SectionHeader } from "@/components/common/SectionHeader";

const stats = [
  { icon: Megaphone, value: "+50 mil", label: "Anúncios ativos" },
  { icon: Users, value: "+12 mil", label: "Vendedores" },
  { icon: ShoppingBag, value: "+150 mil", label: "Vendas realizadas" },
  { icon: Star, value: "98,7%", label: "Avaliações positivas" },
];

export function MarketplaceStats() {
  return (
    <section className="container-lit py-12 md:py-16">
      <SectionHeader
        eyebrow="Nossos números"
        title="Marketplace em números"
        description="A comunidade LIT Buy cresce a cada dia — números atualizados em tempo real."
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {stats.map(({ icon: Icon, value, label }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.45, delay: i * 0.08, ease: "easeOut" }}
            whileHover={{ y: -3 }}
            className="group relative overflow-hidden rounded-xl border border-border bg-card p-5 md:p-6 shadow-card transition-colors hover:border-primary/50"
          >
            <div
              className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-30 blur-2xl transition-opacity group-hover:opacity-60"
              style={{ backgroundImage: "var(--gradient-primary)" }}
            />
            <span
              className="mb-4 grid h-10 w-10 place-items-center rounded-lg text-primary"
              style={{
                backgroundColor: "color-mix(in oklab, var(--primary) 15%, transparent)",
              }}
            >
              <Icon className="h-5 w-5" />
            </span>
            <div className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              {value}
            </div>
            <div className="mt-1 text-xs md:text-sm text-muted-foreground">{label}</div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
