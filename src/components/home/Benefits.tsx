import { ShieldCheck, Zap, Headphones, BadgeCheck } from "lucide-react";

const items = [
  {
    icon: ShieldCheck,
    title: "Pagamento protegido",
    description: "Sua compra segura em todas as etapas, com garantia LIT.",
  },
  {
    icon: Zap,
    title: "Entrega instantânea",
    description: "Receba códigos, contas e itens em segundos após a compra.",
  },
  {
    icon: BadgeCheck,
    title: "Vendedores verificados",
    description: "Comunidade auditada com selo de reputação e histórico.",
  },
  {
    icon: Headphones,
    title: "Suporte 24/7",
    description: "Time dedicado para você em qualquer horário, todos os dias.",
  },
];

export function Benefits() {
  return (
    <section className="container-lit py-14">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="rounded-xl border border-border bg-card p-5 shadow-card"
          >
            <span
              className="mb-4 grid h-10 w-10 place-items-center rounded-lg text-primary"
              style={{
                backgroundColor: "color-mix(in oklab, var(--primary) 15%, transparent)",
              }}
            >
              <Icon className="h-5 w-5" />
            </span>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
