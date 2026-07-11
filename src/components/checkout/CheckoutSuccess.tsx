import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { CheckCircle2, PackageCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatBRL } from "@/lib/format";
import type { MockOrder } from "@/types";

interface CheckoutSuccessProps {
  order: MockOrder;
}

export function CheckoutSuccess({ order }: CheckoutSuccessProps) {
  const created = new Date(order.createdAt).toLocaleString("pt-BR");
  const estimated = new Date(order.estimatedDelivery).toLocaleDateString("pt-BR");

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-8 text-center shadow-card md:p-10"
    >
      <div
        className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl shadow-elegant"
        style={{ backgroundImage: "var(--gradient-primary)" }}
      >
        <CheckCircle2 className="h-8 w-8 text-primary-foreground" />
      </div>

      <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
        Pedido criado em modo demonstração
      </h1>
      <p className="mt-2 text-sm text-muted-foreground md:text-base">
        Este é um checkout mockado — nenhuma cobrança real foi realizada e nenhum
        pedido real foi enviado a um vendedor.
      </p>

      <div className="mt-8 grid gap-3 text-left sm:grid-cols-2">
        <Info label="Número do pedido" value={order.orderId} />
        <Info label="Status" value="Criado (demo)" />
        <Info label="Método de pagamento" value={order.paymentMethodLabel} />
        <Info label="Total" value={formatBRL(order.total)} />
        <Info label="Criado em" value={created} />
        <Info label="Entrega estimada" value={estimated} />
      </div>

      <Separator className="my-8" />

      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Button asChild size="lg">
          <Link to="/pedidos">
            <PackageCheck className="mr-2 h-4 w-4" /> Ver meus pedidos
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link to="/">
            <Sparkles className="mr-2 h-4 w-4" /> Continuar comprando
          </Link>
        </Button>
      </div>
    </motion.div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface/60 p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}
