import { AlertOctagon, Clock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OrderSupportWindow } from "@/services/orderSupportService";

interface Props {
  window: OrderSupportWindow;
  perspective: "buyer" | "seller";
  onReport: () => void;
}

/** Banner fixo no topo do chat com prazo e botão Reportar problema. */
export function OrderChatMediationBanner({
  window: w,
  perspective,
  onReport,
}: Props) {
  const deadline = new Date(w.deadlineDate).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
  const reportLabel =
    perspective === "seller" ? "Reportar problema na venda" : "Reportar problema";

  return (
    <div className="mb-3 rounded-xl border border-warning/30 bg-warning/5 p-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-2">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div className="text-xs">
            <p className="font-semibold text-foreground">
              Solicitação de mediação
            </p>
            <p className="mt-0.5 text-muted-foreground">
              Prazo para esta categoria: <strong>{w.label}</strong>, válido até{" "}
              <strong>{deadline}</strong>.
            </p>
            {w.hasProtectionLit && (
              <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                <ShieldCheck className="h-3 w-3" /> Proteção LIT ativa
              </p>
            )}
            {w.isExpired && (
              <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                <AlertOctagon className="h-3 w-3" /> Prazo encerrado
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-start gap-1 md:items-end">
          <Button
            size="sm"
            variant={w.isExpired ? "outline" : "default"}
            onClick={onReport}
            disabled={w.isExpired}
          >
            <AlertOctagon className="h-3.5 w-3.5" />
            {w.isExpired ? "Prazo encerrado" : reportLabel}
          </Button>
          {!w.isExpired && (
            <span className="text-[10px] text-muted-foreground">
              Disponível até {deadline}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
