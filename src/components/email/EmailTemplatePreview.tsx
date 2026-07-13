import { toast } from "sonner";
import { Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { analyticsService } from "@/services/analyticsService";
import { transactionalEmailService } from "@/services/transactionalEmailService";
import type { TransactionalEmailTemplate } from "@/types";
import { EmailTemplateVariables } from "./EmailTemplateVariables";

interface Props {
  template: TransactionalEmailTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmailTemplatePreview({ template, open, onOpenChange }: Props) {
  if (!template) return null;

  const sendTest = async () => {
    analyticsService.track("email_template_previewed_mocked", { key: template.key });
    await transactionalEmailService.simulateSendTransactionalEmail(template.key);
    toast.success("Envio de teste simulado. Nenhum e-mail real foi enviado.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {template.name}
            <Badge variant="outline" className="text-[10px]">{template.category}</Badge>
            <Badge variant={template.status === "active" ? "default" : "outline"} className="text-[10px]">
              {template.status}
            </Badge>
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">{template.key}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-surface/40 p-3">
            <p className="text-[11px] uppercase text-muted-foreground">Assunto</p>
            <p className="text-sm font-medium text-foreground">{template.subject}</p>
          </div>
          <div className="rounded-xl border border-border bg-surface/40 p-3">
            <p className="text-[11px] uppercase text-muted-foreground">Preview</p>
            <p className="text-sm text-foreground">{template.preview}</p>
          </div>
          <div className="rounded-xl border border-border bg-background/60 p-3">
            <p className="text-[11px] uppercase text-muted-foreground">Corpo</p>
            <pre className="mt-1 whitespace-pre-wrap font-sans text-sm text-foreground">
              {template.body}
            </pre>
          </div>
          <Separator />
          <EmailTemplateVariables variables={template.variables} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={sendTest}>
            <Send className="mr-2 h-4 w-4" /> Enviar teste (mock)
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Templates reais exigirão backend e provedor de e-mail (ex.: Resend, SendGrid, SES).
        </p>
      </DialogContent>
    </Dialog>
  );
}
