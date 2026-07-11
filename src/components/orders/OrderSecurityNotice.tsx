import { ShieldCheck } from "lucide-react";

export function OrderSecurityNotice() {
  return (
    <aside className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground">
      <div className="flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
        <div className="space-y-1">
          <p className="font-medium">Compra protegida pela LIT Buy</p>
          <p className="text-xs text-muted-foreground">
            O pagamento fica retido pela plataforma até você confirmar o
            recebimento. Em caso de problema, abra uma disputa para acionar a
            mediação. Fluxo real será liberado com backend seguro.
          </p>
        </div>
      </div>
    </aside>
  );
}
