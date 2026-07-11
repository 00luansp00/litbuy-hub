import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { orderService } from "@/services/orderService";
import { analyticsService } from "@/services/analyticsService";

const REASONS = [
  { value: "not_received", label: "Não recebi o produto" },
  { value: "different_from_listing", label: "Produto diferente do anunciado" },
  { value: "invalid_credentials", label: "Dados inválidos" },
  { value: "account_recovered", label: "Conta recuperada" },
  { value: "external_contact", label: "Vendedor pediu contato externo" },
  { value: "other", label: "Outro problema" },
];

interface Props {
  orderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReported?: () => void;
}

export function OrderProblemDialog({ orderId, open, onOpenChange, onReported }: Props) {
  const [reason, setReason] = useState<string>(REASONS[0]!.value);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    await orderService.simulateReportDeliveryProblem(orderId, {
      reason,
      description,
    });
    await orderService.simulateOpenMediation(orderId, { reason, description });
    analyticsService.track("mediation_opened_mocked", { orderId, reason });
    setSubmitting(false);
    onOpenChange(false);
    onReported?.();
    toast.success("Mediação aberta (mock)", {
      description: "Nenhum dado foi persistido. Backend real será necessário.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reportar problema no pedido</DialogTitle>
          <DialogDescription>
            Descreva o problema. Em modo demonstração, nada é enviado a um
            backend.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-foreground">
            Motivo
          </label>
          <select
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>

          <label className="block text-sm font-medium text-foreground">
            Descrição
          </label>
          <Textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Conte o que aconteceu…"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            Abrir mediação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
