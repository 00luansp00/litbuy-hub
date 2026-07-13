import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertOctagon,
  ArrowLeft,
  Clock,
  FileText,
  Info,
  Paperclip,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { orderService } from "@/services/orderService";
import { analyticsService } from "@/services/analyticsService";
import {
  MEDIATION_REASONS,
  getMediationDeadline,
  type MediationReasonOption,
} from "@/services/orderSupportService";
import type { Order } from "@/types";

const MIN_CHARS = 10;

interface Props {
  orderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReported?: () => void;
  perspective?: "buyer" | "seller";
}

type Step = "reason" | "description" | "evidence";

export function OrderProblemDialog({
  orderId,
  open,
  onOpenChange,
  onReported,
  perspective = "buyer",
}: Props) {
  const [order, setOrder] = useState<Order | null>(null);
  const [step, setStep] = useState<Step>("reason");
  const [reason, setReason] = useState<MediationReasonOption>(
    MEDIATION_REASONS[0]!,
  );
  const [description, setDescription] = useState("");
  const [evidenceCount, setEvidenceCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep("reason");
    setReason(MEDIATION_REASONS[0]!);
    setDescription("");
    setEvidenceCount(0);
    analyticsService.track("mediation_dialog_opened_mocked", {
      orderId,
      perspective,
    });
    orderService.getOrderById(orderId).then((o) => setOrder(o ?? null));
  }, [open, orderId, perspective]);

  const window = useMemo(
    () => (order ? getMediationDeadline(order) : null),
    [order],
  );

  const deadlineLabel = window
    ? new Date(window.deadlineDate).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";

  const handleSelectReason = (r: MediationReasonOption) => {
    setReason(r);
    analyticsService.track("mediation_reason_selected_mocked", {
      orderId,
      reason: r.value,
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    await orderService.simulateReportDeliveryProblem(orderId, {
      reason: reason.value,
      description,
    });
    await orderService.simulateOpenMediation(orderId, {
      reason: reason.value,
      description,
    });
    analyticsService.track("mediation_submitted_mocked", {
      orderId,
      reason: reason.value,
      evidenceCount,
      perspective,
    });
    analyticsService.track("mediation_opened_mocked", {
      orderId,
      reason: reason.value,
    });
    setSubmitting(false);
    onOpenChange(false);
    onReported?.();
    toast.success("Mediação solicitada (mock)", {
      description:
        "Nenhum dado foi persistido. Backend real será necessário para abrir mediação verdadeira.",
    });
  };

  const canContinueDescription = description.trim().length >= MIN_CHARS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-2">
            <Badge className="bg-warning/15 text-warning border-warning/30">
              Solicitar mediação
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              Passo{" "}
              {step === "reason" ? "1" : step === "description" ? "2" : "3"} / 3
            </Badge>
          </div>
          <DialogTitle>Reportar problema</DialogTitle>
          <DialogDescription>
            Descreva o problema com detalhes para nossa equipe analisar.{" "}
            <Link
              to="/politica-de-reembolso"
              className="font-medium text-primary hover:underline"
            >
              Saiba mais
            </Link>
            .
          </DialogDescription>
        </DialogHeader>

        {/* Prazo & saldo */}
        {window && (
          <div className="space-y-2">
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-2.5 text-xs">
              <div className="flex items-start gap-2">
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">
                    Prazo de suporte desta categoria:
                  </span>{" "}
                  {window.label}. Você deve garantir que todos os trâmites da
                  negociação sejam resolvidos até {deadlineLabel}.
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-xs">
              <div className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Atenção:</span>{" "}
                  caso o saldo ainda não tenha sido liberado ao vendedor, ao
                  abrir uma mediação o saldo ficará retido até a resolução do
                  problema.
                </p>
              </div>
            </div>
          </div>
        )}

        {step === "reason" && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">
              Qual é o motivo do problema?
            </p>
            <div className="grid gap-1.5">
              {MEDIATION_REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => handleSelectReason(r)}
                  className={
                    "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors " +
                    (reason.value === r.value
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-primary/50")
                  }
                >
                  <span>{r.label}</span>
                  {r.suggestReport && (
                    <Badge
                      variant="outline"
                      className="text-[9px] text-destructive"
                    >
                      Sugere denúncia
                    </Badge>
                  )}
                </button>
              ))}
            </div>
            {reason.suggestReport && reason.hint && (
              <p className="mt-1 flex items-start gap-1 rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                <AlertOctagon className="mt-0.5 h-3 w-3 shrink-0" />
                {reason.hint}
              </p>
            )}
            <div className="rounded-lg border border-border bg-surface/40 p-2 text-[11px] text-muted-foreground">
              <Info className="mr-1 inline h-3 w-3" />
              <strong>Mediação</strong> resolve o problema do pedido e pode
              reter saldo. <strong>Denúncia</strong> sinaliza comportamento
              irregular à moderação.
            </div>
          </div>
        )}

        {step === "description" && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">
              Descreva o que aconteceu
            </p>
            <Textarea
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                perspective === "seller"
                  ? "Explique o problema com o comprador ou com a entrega…"
                  : "Conte com detalhes o que aconteceu com o pedido…"
              }
            />
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Mínimo {MIN_CHARS} caracteres</span>
              <span
                className={
                  canContinueDescription ? "text-success" : "text-warning"
                }
              >
                {description.trim().length} / {MIN_CHARS} caracteres
              </span>
            </div>
          </div>
        )}

        {step === "evidence" && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">
              Evidências (opcional)
            </p>
            <p className="text-xs text-muted-foreground">
              Anexe prints, vídeos ou selecione mensagens do chat. Em modo
              demonstração nenhum arquivo é enviado.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setEvidenceCount((v) => v + 1);
                  toast("Evidência adicionada (mock)");
                }}
              >
                <Paperclip className="h-3.5 w-3.5" /> Adicionar print
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setEvidenceCount((v) => v + 1);
                  toast("Vídeo anexado (mock)");
                }}
              >
                <FileText className="h-3.5 w-3.5" /> Adicionar vídeo
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEvidenceCount((v) => v + 1);
                  toast("Mensagens do chat marcadas como evidência (mock)");
                }}
              >
                Selecionar mensagens do chat
              </Button>
            </div>
            {evidenceCount > 0 && (
              <p className="text-[11px] text-success">
                {evidenceCount} evidência(s) anexada(s) em modo demonstração.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {step !== "reason" ? (
            <Button
              variant="ghost"
              onClick={() =>
                setStep(step === "evidence" ? "description" : "reason")
              }
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          )}

          {step === "reason" && (
            <Button onClick={() => setStep("description")}>Continuar</Button>
          )}
          {step === "description" && (
            <Button
              onClick={() => setStep("evidence")}
              disabled={!canContinueDescription}
            >
              Continuar
            </Button>
          )}
          {step === "evidence" && (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Enviando…" : "Solicitar mediação"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
