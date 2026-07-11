import { AlertTriangle, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { orderService } from "@/services/orderService";
import type { Dispute } from "@/types";

const REASONS = [
  { value: "produto_nao_recebido", label: "Não recebi o produto" },
  { value: "produto_diferente", label: "Produto diferente do anunciado" },
  { value: "produto_invalido", label: "Código/dados inválidos" },
  { value: "vendedor_sem_resposta", label: "Vendedor não responde" },
  { value: "outro", label: "Outro motivo" },
];

interface OrderDisputeCardProps {
  orderId: string;
  dispute?: Dispute | null;
  canOpen?: boolean;
}

export function OrderDisputeCard({ orderId, dispute, canOpen }: OrderDisputeCardProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]!.value);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast.error("Descreva o problema para prosseguir.");
      return;
    }
    setSubmitting(true);
    await orderService.simulateOpenDispute(orderId, { reason, description });
    setSubmitting(false);
    setOpen(false);
    setDescription("");
    toast.success("Disputa registrada (mock)", {
      description:
        "Nenhum dado foi enviado — em produção, a equipe de mediação seria acionada.",
    });
  };

  if (dispute && dispute.status !== "none") {
    return (
      <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 shadow-card md:p-6">
        <header className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 shrink-0 text-destructive" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Disputa em andamento
              </h2>
              <p className="text-xs text-muted-foreground">
                Motivo: {dispute.reason ?? "—"}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="border-destructive/40 text-destructive">
            {dispute.status}
          </Badge>
        </header>
        {dispute.description && (
          <p className="text-sm text-foreground">{dispute.description}</p>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground">
          A LIT Buy analisa evidências das duas partes antes de liberar ou
          reembolsar o valor. Fluxo real requer backend/admin.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card md:p-6">
      <header className="mb-3 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Teve algum problema com este pedido?
          </h2>
          <p className="text-xs text-muted-foreground">
            Abra uma disputa e a LIT Buy vai mediar entre você e o vendedor.
          </p>
        </div>
      </header>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" disabled={!canOpen} aria-disabled={!canOpen}>
            Abrir disputa
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Abrir disputa</DialogTitle>
            <DialogDescription>
              Todos os dados abaixo são mockados. Nada é enviado ao vendedor
              nem à mediação neste ambiente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Motivo</Label>
              <RadioGroup value={reason} onValueChange={setReason}>
                {REASONS.map((r) => (
                  <div key={r.value} className="flex items-center gap-2">
                    <RadioGroupItem id={r.value} value={r.value} />
                    <Label htmlFor={r.value} className="cursor-pointer text-sm">
                      {r.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dispute-desc">Descrição</Label>
              <Textarea
                id="dispute-desc"
                rows={4}
                placeholder="Explique com detalhes o que aconteceu."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Envio de evidências (prints, e-mails) será suportado quando o
                backend seguro estiver disponível.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              Enviar disputa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
