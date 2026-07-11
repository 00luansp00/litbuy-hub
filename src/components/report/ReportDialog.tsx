import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Image as ImageIcon, Video, Link2, MessageSquare, Plus, X } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReportSecurityNotice } from "./ReportSecurityNotice";
import { ReportSeverityBadge } from "./ReportSeverityBadge";
import { reportService } from "@/services/reportService";
import { analyticsService } from "@/services/analyticsService";
import type {
  Report,
  ReportContext,
  ReportEvidence,
  ReportReason,
  ReportSeverity,
  ReportSource,
  ReportTargetType,
} from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: ReportTargetType;
  targetId: string;
  targetLabel: string;
  context?: ReportContext;
  source?: ReportSource;
  defaultReason?: string;
  onSubmitted?: (report: Report) => void;
}

const EVIDENCE_KINDS: {
  kind: ReportEvidence["kind"];
  label: string;
  icon: React.ReactNode;
}[] = [
  { kind: "image", label: "Print", icon: <ImageIcon className="h-3.5 w-3.5" /> },
  { kind: "video", label: "Vídeo", icon: <Video className="h-3.5 w-3.5" /> },
  { kind: "link", label: "Link interno", icon: <Link2 className="h-3.5 w-3.5" /> },
  { kind: "message", label: "Mensagem", icon: <MessageSquare className="h-3.5 w-3.5" /> },
];

export function ReportDialog({
  open,
  onOpenChange,
  targetType,
  targetId,
  targetLabel,
  context,
  source,
  defaultReason,
  onSubmitted,
}: Props) {
  const [reasons, setReasons] = useState<ReportReason[]>([]);
  const [reasonValue, setReasonValue] = useState<string>("");
  const [severity, setSeverity] = useState<ReportSeverity>("medium");
  const [description, setDescription] = useState("");
  const [evidence, setEvidence] = useState<ReportEvidence[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    void reportService.getReportReasons(targetType).then((r) => {
      if (!mounted) return;
      setReasons(r);
      const initial = r.find((x) => x.value === defaultReason) ?? r[0];
      if (initial) {
        setReasonValue(initial.value);
        setSeverity(initial.severity);
      }
    });
    analyticsService.track("report_dialog_opened_mocked", {
      targetType,
      targetId,
      source,
    });
    return () => {
      mounted = false;
    };
  }, [open, targetType, targetId, defaultReason, source]);

  const currentReason = useMemo(
    () => reasons.find((r) => r.value === reasonValue),
    [reasons, reasonValue],
  );

  const handleReasonChange = (v: string) => {
    setReasonValue(v);
    const r = reasons.find((x) => x.value === v);
    if (r) setSeverity(r.severity);
    analyticsService.track("report_reason_selected_mocked", {
      targetType,
      targetId,
      reason: v,
    });
  };

  const addEvidence = (kind: ReportEvidence["kind"]) => {
    const label =
      kind === "image"
        ? "Print anexado (mock)"
        : kind === "video"
          ? "Vídeo anexado (mock)"
          : kind === "link"
            ? "Link interno anexado (mock)"
            : "Mensagem selecionada (mock)";
    setEvidence((prev) => [
      ...prev,
      {
        id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        kind,
        label,
        hint: "Demonstração. Arquivos não são enviados para servidor.",
      },
    ]);
  };

  const removeEvidence = (id: string) =>
    setEvidence((prev) => prev.filter((e) => e.id !== id));

  const resetAndClose = () => {
    setDescription("");
    setEvidence([]);
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!currentReason) return;
    setSubmitting(true);
    const report = await reportService.simulateSubmitReport({
      targetType,
      targetId,
      targetLabel,
      reason: currentReason.value,
      reasonLabel: currentReason.label,
      severity,
      description,
      evidence,
      context,
      source,
    });
    analyticsService.track("report_submitted_mocked", {
      targetType,
      targetId,
      reason: currentReason.value,
      severity,
    });
    setSubmitting(false);
    onSubmitted?.(report);
    toast.success("Denúncia registrada em modo demonstração", {
      description:
        "Em produção, a equipe da LIT Buy analisará o caso.",
    });
    resetAndClose();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reportar {targetLabelForType(targetType)}</DialogTitle>
          <DialogDescription>
            Denuncie comportamento irregular, golpe, contato externo ou anúncio
            proibido. Este canal é diferente de mediação de pedidos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface/40 p-3 text-xs">
            <div className="text-muted-foreground">Alvo denunciado</div>
            <div className="mt-0.5 truncate font-medium text-foreground">
              {targetLabel}
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <Badge variant="secondary" className="text-[10px]">
                {targetLabelForType(targetType)}
              </Badge>
              <ReportSeverityBadge severity={severity} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Motivo da denúncia
            </label>
            <Select value={reasonValue} onValueChange={handleReasonChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um motivo" />
              </SelectTrigger>
              <SelectContent>
                {reasons.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentReason && (
              <p className="text-[11px] text-muted-foreground">
                Severidade sugerida:{" "}
                <span className="font-medium text-foreground">
                  {currentReason.severity}
                </span>
                . Você pode ajustar se necessário.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Severidade
            </label>
            <Select
              value={severity}
              onValueChange={(v) => setSeverity(v as ReportSeverity)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Baixa</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="critical">Crítica</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Detalhes
            </label>
            <Textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o que aconteceu com o máximo de contexto possível."
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-sm font-medium text-foreground">
                Evidências (mock)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {EVIDENCE_KINDS.map((k) => (
                  <Button
                    key={k.kind}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addEvidence(k.kind)}
                    className="h-7 px-2 text-[11px]"
                  >
                    <Plus className="h-3 w-3" /> {k.icon} {k.label}
                  </Button>
                ))}
              </div>
            </div>
            {evidence.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                Nenhuma evidência anexada. Em produção, prints e vídeos
                ajudarão a moderação.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {evidence.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-surface/40 p-2 text-xs"
                  >
                    <span className="truncate">
                      <span className="text-muted-foreground">
                        [{e.kind}]{" "}
                      </span>
                      {e.label}
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => removeEvidence(e.id)}
                      aria-label="Remover evidência"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[10px] text-muted-foreground">
              Demonstração. Arquivos não são enviados para servidor.
            </p>
          </div>

          <ReportSecurityNotice />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !reasonValue}
          >
            Enviar denúncia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function targetLabelForType(t: ReportTargetType): string {
  switch (t) {
    case "product":
      return "anúncio";
    case "seller":
      return "vendedor";
    case "message":
      return "mensagem";
    case "conversation":
      return "conversa";
    case "order":
      return "pedido";
    case "sale":
      return "venda";
    case "user":
      return "usuário";
    case "payment":
      return "pagamento";
    default:
      return "conteúdo";
  }
}
