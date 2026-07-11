import { Eye, EyeOff, Lock, Zap, Clock, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DigitalDelivery, DeliveryStatus } from "@/types";

const STATUS: Record<DeliveryStatus, { label: string; tone: string; Icon: typeof Zap }> = {
  pending: { label: "Aguardando pagamento", tone: "text-warning", Icon: Clock },
  in_progress: { label: "Vendedor processando", tone: "text-primary", Icon: Clock },
  delivered: { label: "Entregue", tone: "text-accent", Icon: Zap },
  confirmed: { label: "Confirmado por você", tone: "text-success", Icon: Zap },
  failed: { label: "Falha na entrega", tone: "text-destructive", Icon: XCircle },
};

interface DigitalDeliveryCardProps {
  delivery: DigitalDelivery;
  canConfirm?: boolean;
  onConfirm?: () => void;
  onReport?: () => void;
}

export function DigitalDeliveryCard({
  delivery,
  canConfirm,
  onConfirm,
  onReport,
}: DigitalDeliveryCardProps) {
  const [reveal, setReveal] = useState(false);
  const meta = STATUS[delivery.status];
  const Icon = meta.Icon;

  const handleReveal = () => {
    if (reveal) {
      setReveal(false);
      return;
    }
    toast("Visualização mockada", {
      description:
        "Dados digitais reais só serão exibidos com backend seguro. Nada é liberado neste ambiente.",
    });
    setReveal(true);
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card md:p-6">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Entrega digital
          </h2>
          <p className="text-xs text-muted-foreground">
            Modo: {delivery.method === "auto"
              ? "automática"
              : delivery.method === "manual"
                ? "manual pelo vendedor"
                : "via chat"}
          </p>
        </div>
        <Badge variant="outline" className={cn("gap-1.5", meta.tone)}>
          <Icon className="h-3.5 w-3.5" /> {meta.label}
        </Badge>
      </header>

      {delivery.instructions && (
        <p className="mb-4 text-sm text-muted-foreground">{delivery.instructions}</p>
      )}

      <div className="rounded-xl border border-dashed border-border bg-surface/50 p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            Dados de entrega
          </div>
          <Button size="sm" variant="ghost" onClick={handleReveal}>
            {reveal ? (
              <>
                <EyeOff className="h-4 w-4" /> Ocultar
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" /> Revelar
              </>
            )}
          </Button>
        </div>
        <div
          className={cn(
            "select-none rounded-md bg-background/70 p-3 font-mono text-sm text-foreground",
            !reveal && "blur-sm",
          )}
          aria-hidden={!reveal}
        >
          {delivery.maskedPayload ?? "•••• •••• •••• ••••"}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Este marketplace é intermediador. Dados sensíveis reais exigem backend
          seguro e verificação de sessão — nada é armazenado no frontend.
        </p>
      </div>

      {delivery.deliveredAt && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Entregue em{" "}
          {new Date(delivery.deliveredAt).toLocaleString("pt-BR", {
            dateStyle: "short",
            timeStyle: "short",
          })}
          .
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          onClick={onConfirm}
          disabled={!canConfirm}
          aria-disabled={!canConfirm}
        >
          Confirmar recebimento
        </Button>
        <Button variant="outline" onClick={onReport}>
          Reportar problema
        </Button>
      </div>
    </section>
  );
}
