import { AlertTriangle, QrCode, FileText, CreditCard, Wallet, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL } from "@/lib/format";
import type {
  BuyerProfile,
  LitPointsCheckoutPreview,
  MockWalletBalance,
  PaymentMethodId,
} from "@/types";

interface PaymentMethodBlockProps {
  method: PaymentMethodId;
  buyer: BuyerProfile;
  total: number;
  walletBalance: MockWalletBalance;
  litPoints: LitPointsCheckoutPreview;
  loading?: boolean;
  onGenerate: () => void;
}

/**
 * Bloco específico exibido abaixo dos métodos de pagamento no checkout.
 * TUDO mockado e demonstrativo — nunca coleta dado real.
 */
export function PaymentMethodBlock(props: PaymentMethodBlockProps) {
  const { method } = props;
  switch (method) {
    case "pix":
      return <PixBlock {...props} />;
    case "boleto":
      return <BoletoBlock {...props} />;
    case "credit_card":
      return <CardBlock {...props} />;
    case "lit_balance":
      return <LitBalanceBlock {...props} />;
    case "lit_points":
      return <LitPointsBlock {...props} />;
    default:
      return null;
  }
}

function Shell({
  icon,
  title,
  warning,
  children,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  warning: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-xl border border-border bg-surface/40 p-4">
      <header className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-card text-primary">
          {icon}
        </span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
      <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-2 text-[11px] text-warning">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{warning}</span>
      </div>
      {action}
    </section>
  );
}

function DemoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Input value={value} disabled className="mt-1 text-xs" />
    </div>
  );
}

function PixBlock({ buyer, total, loading, onGenerate }: PaymentMethodBlockProps) {
  return (
    <Shell
      icon={<QrCode className="h-4 w-4" />}
      title="Pagamento via Pix"
      warning="Modo demonstração. Nenhum Pix real será gerado. Não insira dados reais."
      action={
        <Button onClick={onGenerate} disabled={loading} className="w-full sm:w-auto">
          Gerar Pix demonstrativo
        </Button>
      }
    >
      <DemoField label="Nome do comprador (demo)" value={buyer.name} />
      <DemoField label="CPF fictício mascarado" value={buyer.maskedTaxId ?? "***.***.***-00"} />
      <DemoField label="Valor" value={formatBRL(total)} />
      <DemoField label="Expiração estimada" value="30 minutos" />
    </Shell>
  );
}

function BoletoBlock({ buyer, total, loading, onGenerate }: PaymentMethodBlockProps) {
  return (
    <Shell
      icon={<FileText className="h-4 w-4" />}
      title="Pagamento via Boleto"
      warning="Modo demonstração. Nenhum boleto real será emitido."
      action={
        <Button onClick={onGenerate} disabled={loading} className="w-full sm:w-auto">
          Gerar boleto demonstrativo
        </Button>
      }
    >
      <DemoField label="Nome do comprador (demo)" value={buyer.name} />
      <DemoField label="CPF fictício mascarado" value={buyer.maskedTaxId ?? "***.***.***-00"} />
      <DemoField label="Vencimento estimado" value="3 dias úteis" />
      <DemoField label="Taxa operacional demo" value={formatBRL(3.5)} />
      <DemoField label="Valor total" value={formatBRL(total + 3.5)} />
    </Shell>
  );
}

function CardBlock({ total, loading, onGenerate }: PaymentMethodBlockProps) {
  return (
    <Shell
      icon={<CreditCard className="h-4 w-4" />}
      title="Cartão de crédito"
      warning="Demonstração. Não insira dados reais de cartão. Cartão real será processado por gateway seguro em produção."
      action={
        <Button onClick={onGenerate} disabled={loading} className="w-full sm:w-auto">
          Simular pagamento com cartão
        </Button>
      }
    >
      <DemoField label="Nome no cartão (fictício)" value="COMPRADOR DEMO" />
      <DemoField label="Número do cartão" value="•••• •••• •••• 0000" />
      <DemoField label="Validade" value="12/34" />
      <DemoField label="CVV" value="•••" />
      <DemoField label="Parcelas demo" value={`1x de ${formatBRL(total)}`} />
    </Shell>
  );
}

function LitBalanceBlock({
  walletBalance,
  total,
  loading,
  onGenerate,
}: PaymentMethodBlockProps) {
  const insufficient = walletBalance.balance < total;
  const remaining = Math.max(0, walletBalance.balance - total);
  return (
    <Shell
      icon={<Wallet className="h-4 w-4" />}
      title="Saldo LIT"
      warning="Saldo demonstrativo. Nenhum débito real é feito. Carteira real exige backend."
      action={
        <Button
          onClick={onGenerate}
          disabled={loading || insufficient}
          className="w-full sm:w-auto"
        >
          Pagar com Saldo LIT
        </Button>
      }
    >
      <DemoField label="Saldo disponível (mock)" value={formatBRL(walletBalance.balance)} />
      <DemoField label="Valor do pedido" value={formatBRL(total)} />
      <DemoField
        label={insufficient ? "Saldo insuficiente" : "Saldo restante após compra"}
        value={insufficient ? "—" : formatBRL(remaining)}
      />
    </Shell>
  );
}

function LitPointsBlock({
  litPoints,
  total,
  loading,
  onGenerate,
}: PaymentMethodBlockProps) {
  const required = litPoints.requiredForOrder;
  const insufficient = litPoints.balance < required;
  const remaining = Math.max(0, litPoints.balance - required);
  return (
    <Shell
      icon={<Sparkles className="h-4 w-4" />}
      title="LIT Points"
      warning="Uso de LIT Points em compras é demonstrativo. Regras reais serão definidas no backend."
      action={
        <Button
          onClick={onGenerate}
          disabled={loading || insufficient}
          className="w-full sm:w-auto"
        >
          Pagar com LIT Points
        </Button>
      }
    >
      <DemoField label="Saldo LIT Points (mock)" value={litPoints.balance.toLocaleString("pt-BR")} />
      <DemoField
        label="Cotação demonstrativa"
        value={`1 ponto ≈ ${formatBRL(litPoints.quote)}`}
      />
      <DemoField label="Valor do pedido" value={formatBRL(total)} />
      <DemoField label="Pontos necessários" value={required.toLocaleString("pt-BR")} />
      <DemoField
        label={insufficient ? "Pontos insuficientes" : "Pontos restantes após compra"}
        value={insufficient ? "—" : remaining.toLocaleString("pt-BR")}
      />
    </Shell>
  );
}
