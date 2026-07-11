import { motion } from "motion/react";
import { CheckCircle2, PackagePlus, ShieldCheck, ShoppingBag, Wallet } from "lucide-react";

const STEPS = [
  {
    icon: PackagePlus,
    title: "Crie seu anúncio",
    description: "Descreva o produto, defina preço e adicione imagens.",
  },
  {
    icon: ShoppingBag,
    title: "Receba pedidos",
    description: "Compradores encontram sua loja através da busca e categorias.",
  },
  {
    icon: ShieldCheck,
    title: "Entregue com segurança",
    description: "Use a entrega instantânea ou combine no chat com o comprador.",
  },
  {
    icon: Wallet,
    title: "Libere seu saldo",
    description: "Solicite o saque quando quiser dos valores disponíveis.",
  },
];

export function SellerOnboardingCard() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl border border-dashed border-border bg-card/60 p-5 shadow-card"
    >
      <header className="mb-4 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-primary" />
        <h3 className="text-lg font-bold text-foreground">Como funciona</h3>
      </header>
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <li
            key={s.title}
            className="rounded-xl border border-border bg-surface/40 p-3"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-primary">
                {i + 1}
              </span>
              <s.icon className="h-4 w-4" />
            </div>
            <div className="mt-2 text-sm font-semibold text-foreground">{s.title}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{s.description}</div>
          </li>
        ))}
      </ol>
    </motion.section>
  );
}
