import { Lock, ShieldCheck, Sparkles } from "lucide-react";

export function CartSecurityNotice() {
  return (
    <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground sm:grid-cols-3">
      <Item icon={ShieldCheck} tone="text-success">
        Compra protegida pela garantia LIT Buy.
      </Item>
      <Item icon={Lock} tone="text-primary">
        Seus dados são criptografados em toda a jornada.
      </Item>
      <Item icon={Sparkles} tone="text-warning">
        Suporte humano em caso de qualquer problema.
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
