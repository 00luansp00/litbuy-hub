import { MessageSquare } from "lucide-react";

interface MessageEmptyStateProps {
  title?: string;
  description?: string;
}

export function MessageEmptyState({
  title = "Selecione uma conversa",
  description = "Escolha uma conversa à esquerda para visualizar as mensagens.",
}: MessageEmptyStateProps) {
  return (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-surface text-muted-foreground">
        <MessageSquare className="h-6 w-6" />
      </span>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
