import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { transactionalEmailService } from "@/services/transactionalEmailService";
import { analyticsService } from "@/services/analyticsService";
import type { EmailHistoryItem } from "@/types";

const DELIVERY_LABEL: Record<EmailHistoryItem["deliveryStatus"], string> = {
  queued: "Na fila",
  sent: "Enviado",
  delivered: "Entregue",
  opened: "Aberto",
  bounced: "Retornado",
  failed: "Falhou",
};

interface Props {
  history: EmailHistoryItem[];
}

export function EmailHistoryTable({ history }: Props) {
  const resend = async (item: EmailHistoryItem) => {
    analyticsService.track("email_resend_clicked_mocked", { eventKey: item.eventKey });
    await transactionalEmailService.simulateResendEmail(item.eventKey ?? "unknown");
    toast.success("Reenvio simulado. Nenhum e-mail real foi enviado.");
  };

  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Assunto</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Canal</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Data</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.map((h) => (
            <TableRow key={h.id}>
              <TableCell className="max-w-[280px] truncate font-medium text-foreground">
                {h.subject}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-[10px]">{h.category}</Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{h.channel}</TableCell>
              <TableCell>
                <Badge variant={h.deliveryStatus === "failed" || h.deliveryStatus === "bounced" ? "destructive" : "secondary"}>
                  {DELIVERY_LABEL[h.deliveryStatus]}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(h.sentAt), { locale: ptBR, addSuffix: true })}
              </TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="ghost" onClick={() => resend(h)}>
                  <RotateCcw className="mr-1 h-3 w-3" /> Reenviar
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="border-t border-border p-3 text-[11px] text-muted-foreground">
        Histórico visual/mockado. Registros reais viverão no backend.
      </p>
    </div>
  );
}
