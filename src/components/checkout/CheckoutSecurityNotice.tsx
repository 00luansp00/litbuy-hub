import { Info, Lock, ShieldCheck } from "lucide-react";

export function CheckoutSecurityNotice() {
  return (
    <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground sm:grid-cols-3">
      <Item icon={ShieldCheck} tone="text-success">
        Modo demonstração: nenhuma cobrança real será feita.
      </Item>
      <Item icon={Lock} tone="text-primary">
        Nenhum dado sensível de pagamento é coletado no frontend.
      </Item>
      <Item icon={Info} tone="text-warning">
        A integração oficial com pagamentos será feita em sprint dedicada.
      </Item>
    </div>
  );
}

function Item({
  icon: Icon,
  tone,
  children,
}: {
  icon: typeof ShieldCheck;
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone}`} />
      <span>{children}</span>
    </div>
  );
}
