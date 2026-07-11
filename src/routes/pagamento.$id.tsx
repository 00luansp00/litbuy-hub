import { useEffect, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { motion } from "motion/react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ShoppingBag,
  Copy,
  QrCode,
  FileText,
  CreditCard,
  Wallet,
  Sparkles,
  Loader2,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { AuthGate } from "@/components/auth/AuthGate";
import { Breadcrumb } from "@/components/common/Breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatBRL } from "@/lib/format";
import { paymentService } from "@/services/paymentService";
import type { PaymentIntent, PaymentMethodId, PaymentStatus } from "@/types";

export const Route = createFileRoute("/pagamento/$id")({
  loader: async ({ params }) => {
    const intent = await paymentService.getMockPaymentById(params.id);
    if (!intent) throw notFound();
    return { intent };
  },
  component: PaymentDetailPage,
  notFoundComponent: PaymentNotFound,
});

function PaymentDetailPage() {
  const { intent } = Route.useLoaderData();
  return (
    <AuthGate
      title="Entre para acompanhar o pagamento"
      description="Você precisa estar logado para acompanhar o pagamento demonstrativo."
    >
      <div className="container-lit space-y-6 py-6 md:space-y-8 md:py-10">
        <Breadcrumb
          items={[
            { label: "Home", to: "/" },
            { label: "Meus pedidos", to: "/pedidos" },
            { label: `Pagamento ${intent.id}` },
          ]}
        />

        <PaymentHeader intent={intent} />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-6">
            <PaymentMethodView intent={intent} />
            <PaymentInstructions method={intent.method} />
            <PaymentItems intent={intent} />
          </div>
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <PaymentSummarySide intent={intent} />
          </aside>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/pedidos">
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para pedidos
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/">
              <ShoppingBag className="mr-2 h-4 w-4" /> Voltar para marketplace
            </Link>
          </Button>
        </div>
      </div>
    </AuthGate>
  );
}

function statusTone(status: PaymentStatus): {
  label: string;
  className: string;
  icon: React.ReactNode;
} {
  switch (status) {
    case "approved":
      return {
        label: "Aprovado em demonstração",
        className: "bg-success/10 text-success border-success/30",
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      };
    case "processing":
      return {
        label: "Processando",
        className: "bg-primary/10 text-primary border-primary/30",
        icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
      };
    case "expired":
      return {
        label: "Expirado",
        className: "bg-muted text-muted-foreground border-border",
        icon: <Clock className="h-3.5 w-3.5" />,
      };
    case "rejected":
    case "cancelled":
      return {
        label: "Cancelado",
        className: "bg-destructive/10 text-destructive border-destructive/30",
        icon: <AlertTriangle className="h-3.5 w-3.5" />,
      };
    default:
      return {
        label: "Pendente",
        className: "bg-warning/10 text-warning border-warning/30",
        icon: <Clock className="h-3.5 w-3.5" />,
      };
  }
}

function PaymentHeader({ intent }: { intent: PaymentIntent }) {
  const tone = statusTone(intent.status);
  return (
    <motion.header
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-card md:flex-row md:items-center md:justify-between"
    >
      <div>
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">
          Pagamento {tone.label.toLowerCase()}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pagamento demonstrativo <span className="font-mono">{intent.id}</span>{" "}
          · Pedido fictício <span className="font-mono">{intent.orderCode}</span>
        </p>
      </div>
      <div className="flex flex-col items-start gap-2 md:items-end">
        <Badge className={`inline-flex items-center gap-1 border ${tone.className}`}>
          {tone.icon}
          {tone.label}
        </Badge>
        <div className="text-lg font-bold text-foreground">
          {formatBRL(intent.amount)}
        </div>
      </div>
    </motion.header>
  );
}

function PaymentMethodView({ intent }: { intent: PaymentIntent }) {
  switch (intent.method) {
    case "pix":
      return <PixView intent={intent} />;
    case "boleto":
      return <BoletoView intent={intent} />;
    case "credit_card":
      return <CardView intent={intent} />;
    case "lit_balance":
      return <LitBalanceView intent={intent} />;
    case "lit_points":
      return <LitPointsView intent={intent} />;
    default:
      return null;
  }
}

function DemoWarning({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-2 text-[11px] text-warning">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}

function Countdown({ iso }: { iso?: string }) {
  const [left, setLeft] = useState<string>("");
  useEffect(() => {
    if (!iso) return;
    const tick = () => {
      const ms = new Date(iso).getTime() - Date.now();
      if (ms <= 0) {
        setLeft("Expirado");
        return;
      }
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setLeft(`${m}m ${s.toString().padStart(2, "0")}s`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [iso]);
  if (!iso) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Clock className="h-3 w-3" /> Expira em {left}
    </span>
  );
}

function PixView({ intent }: { intent: PaymentIntent }) {
  const code = intent.details.pixCode ?? "";
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card">
      <header className="flex items-center gap-2">
        <QrCode className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold text-foreground">Pagamento via Pix</h2>
        <div className="ml-auto">
          <Countdown iso={intent.expiresAt} />
        </div>
      </header>
      <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
        <div className="grid aspect-square place-items-center rounded-xl border border-dashed border-border bg-surface/60 p-4">
          <div className="grid h-full w-full grid-cols-8 gap-0.5">
            {Array.from({ length: 64 }).map((_, i) => (
              <span
                key={i}
                className={
                  (i * 37) % 3 === 0 ? "bg-foreground" : "bg-transparent"
                }
              />
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Código Pix "copia e cola" (fictício):
          </p>
          <div className="break-all rounded-md border border-border bg-surface/60 p-3 font-mono text-[11px] text-muted-foreground">
            {code}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard?.writeText(code).catch(() => {});
              toast.success("Código Pix fictício copiado (mock)");
            }}
          >
            <Copy className="mr-2 h-4 w-4" /> Copiar código
          </Button>
        </div>
      </div>
      <DemoWarning text="Este QR Code é fictício e não gera cobrança real." />
    </section>
  );
}

function BoletoView({ intent }: { intent: PaymentIntent }) {
  const line = intent.details.boletoLine ?? "";
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card">
      <header className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold text-foreground">Pagamento via Boleto</h2>
      </header>
      <div className="space-y-3">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Linha digitável (fictícia):</p>
          <div className="break-all rounded-md border border-border bg-surface/60 p-3 font-mono text-xs text-foreground">
            {line}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              navigator.clipboard?.writeText(line).catch(() => {});
              toast.success("Linha digitável fictícia copiada (mock)");
            }}
          >
            <Copy className="mr-2 h-4 w-4" /> Copiar linha
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => toast.info("Boleto demonstrativo — nenhum PDF real")}
          >
            Visualizar boleto demonstrativo
          </Button>
        </div>
      </div>
      <DemoWarning text="Boleto demonstrativo. Nenhuma cobrança real foi emitida." />
    </section>
  );
}

function CardView({ intent }: { intent: PaymentIntent }) {
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card">
      <header className="flex items-center gap-2">
        <CreditCard className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold text-foreground">Cartão de crédito</h2>
      </header>
      <ul className="space-y-1 text-sm">
        <li className="flex justify-between">
          <span className="text-muted-foreground">Final fictício</span>
          <span className="font-medium">•••• {intent.details.cardLast4 ?? "0000"}</span>
        </li>
        <li className="flex justify-between">
          <span className="text-muted-foreground">Parcelas demonstrativas</span>
          <span className="font-medium">
            {intent.details.installments ?? 1}x de{" "}
            {formatBRL(intent.amount / (intent.details.installments ?? 1))}
          </span>
        </li>
      </ul>
      <DemoWarning text="Nenhum cartão real foi processado. Cobrança real depende de gateway seguro em produção." />
    </section>
  );
}

function LitBalanceView({ intent }: { intent: PaymentIntent }) {
  const wallet = paymentService.getMockWalletBalance();
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card">
      <header className="flex items-center gap-2">
        <Wallet className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold text-foreground">Saldo LIT</h2>
      </header>
      <ul className="space-y-1 text-sm">
        <li className="flex justify-between">
          <span className="text-muted-foreground">Saldo usado</span>
          <span className="font-medium">
            {formatBRL(intent.details.litBalanceUsed ?? intent.amount)}
          </span>
        </li>
        <li className="flex justify-between">
          <span className="text-muted-foreground">Saldo restante (mock)</span>
          <span className="font-medium">
            {formatBRL(Math.max(0, wallet.balance - intent.amount))}
          </span>
        </li>
      </ul>
      <DemoWarning text="Nenhum saldo real foi debitado. Carteira real exige backend." />
    </section>
  );
}

function LitPointsView({ intent }: { intent: PaymentIntent }) {
  const balance = paymentService.getMockLitPointsBalance();
  const used = intent.details.litPointsUsed ?? 0;
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card">
      <header className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-bold text-foreground">LIT Points</h2>
      </header>
      <ul className="space-y-1 text-sm">
        <li className="flex justify-between">
          <span className="text-muted-foreground">Pontos usados</span>
          <span className="font-medium">{used.toLocaleString("pt-BR")}</span>
        </li>
        <li className="flex justify-between">
          <span className="text-muted-foreground">Pontos restantes (mock)</span>
          <span className="font-medium">
            {Math.max(0, balance - used).toLocaleString("pt-BR")}
          </span>
        </li>
      </ul>
      <DemoWarning text="Nenhum ponto real foi debitado. Regras finais dependem do backend." />
    </section>
  );
}

function PaymentInstructions({ method }: { method: PaymentMethodId }) {
  const steps: Record<PaymentMethodId, string[] | null> = {
    pix: [
      "Abra o app do banco.",
      "Escaneie o QR Code ou cole o código.",
      "Confirme o pagamento.",
      "Aguarde aprovação.",
    ],
    boleto: [
      "Copie a linha digitável.",
      "Pague no app do banco ou lotérica.",
      "Aguarde a compensação (até 2 dias úteis).",
    ],
    credit_card: [
      "O gateway seguro processará o cartão em produção.",
      "Nesta demonstração, o pagamento é apenas visual.",
    ],
    lit_balance: null,
    lit_points: null,
    external_wallet: null,
  };
  const s = steps[method];
  if (!s) return null;
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <h3 className="text-sm font-semibold text-foreground">Como pagar</h3>
      <ol className="mt-2 space-y-1 text-xs text-muted-foreground">
        {s.map((line, i) => (
          <li key={i}>
            <span className="mr-1 font-semibold text-foreground">{i + 1}.</span>
            {line}
          </li>
        ))}
      </ol>
    </section>
  );
}

function PaymentItems({ intent }: { intent: PaymentIntent }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <h3 className="text-sm font-semibold text-foreground">Resumo do pedido</h3>
      <ul className="mt-3 divide-y divide-border">
        {intent.items.map((item) => (
          <li key={item.key} className="flex gap-3 py-3 first:pt-0 last:pb-0">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-surface">
              <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-foreground">
                {item.title}
              </div>
              {item.selectedVariantTitle && (
                <div className="text-[11px] text-primary">
                  Variação: {item.selectedVariantTitle}
                </div>
              )}
              <div className="text-[11px] text-muted-foreground">
                {item.quantity} × {formatBRL(item.price)}
              </div>
            </div>
            <div className="text-right text-sm font-bold text-foreground">
              {formatBRL(item.price * item.quantity)}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PaymentSummarySide({ intent }: { intent: PaymentIntent }) {
  const s = intent.summary;
  return (
    <aside className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-card">
      <h3 className="text-sm font-bold text-foreground">Detalhes financeiros</h3>
      <Row label="Subtotal" value={formatBRL(s.subtotal)} />
      {s.discount > 0 && (
        <Row label="Desconto" value={`- ${formatBRL(s.discount)}`} tone="success" />
      )}
      {s.protectionFee > 0 && (
        <Row label="Proteção LIT" value={formatBRL(s.protectionFee)} tone="accent" />
      )}
      {s.operationalFee > 0 && (
        <Row label="Taxa operacional" value={formatBRL(s.operationalFee)} />
      )}
      <Separator />
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted-foreground">Total</span>
        <span className="text-xl font-bold">{formatBRL(s.total)}</span>
      </div>
      <div className="rounded-md border border-dashed border-border bg-surface/60 p-2 text-[11px] text-muted-foreground">
        Método: <span className="font-medium text-foreground">{intent.methodLabel}</span>
      </div>
      {intent.protectionEnabled && (
        <Badge variant="secondary" className="w-fit text-[10px]">
          Proteção LIT ativa (demo)
        </Badge>
      )}
      <div className="rounded-md border border-accent/30 bg-accent/5 p-2 text-[11px] text-accent">
        Você ganhará +{s.litPointsEarned.toLocaleString("pt-BR")} LIT Points (mock).
      </div>
    </aside>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "accent";
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          tone === "success"
            ? "font-medium text-success"
            : tone === "accent"
              ? "font-medium text-accent"
              : "font-medium text-foreground"
        }
      >
        {value}
      </span>
    </div>
  );
}

function PaymentNotFound() {
  return (
    <div className="container-lit py-12">
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-card">
        <h1 className="text-xl font-bold text-foreground">
          Pagamento não encontrado
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Esse pagamento demonstrativo não existe ou expirou nesta sessão.
        </p>
        <Button asChild className="mt-4">
          <Link to="/pedidos">Ir para meus pedidos</Link>
        </Button>
      </div>
    </div>
  );
}
