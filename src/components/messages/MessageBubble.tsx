import { Check, CheckCheck, Clock, Info } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { ConversationMessage, ConversationParticipant } from "@/types";

interface MessageBubbleProps {
  message: ConversationMessage;
  currentUserId: string;
  counterpart: ConversationParticipant;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusIcon({ status }: { status: ConversationMessage["status"] }) {
  if (status === "pending")
    return <Clock className="h-3 w-3 text-muted-foreground" aria-label="Enviando" />;
  if (status === "read")
    return <CheckCheck className="h-3 w-3 text-primary" aria-label="Lida" />;
  if (status === "delivered")
    return <CheckCheck className="h-3 w-3 text-muted-foreground" aria-label="Entregue" />;
  return <Check className="h-3 w-3 text-muted-foreground" aria-label="Enviada" />;
}

export function MessageBubble({
  message,
  currentUserId,
  counterpart,
}: MessageBubbleProps) {
  if (message.system) {
    return (
      <div className="my-2 flex items-center justify-center">
        <div className="inline-flex max-w-md items-start gap-2 rounded-full border border-border bg-surface/70 px-3 py-1.5 text-[11px] text-muted-foreground">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{message.text}</span>
        </div>
      </div>
    );
  }

  const isMine = message.authorId === currentUserId;

  return (
    <div
      className={cn(
        "flex items-end gap-2",
        isMine ? "flex-row-reverse" : "flex-row",
      )}
    >
      {!isMine && (
        <Avatar className="h-7 w-7 border border-border">
          {counterpart.avatarUrl && (
            <AvatarImage src={counterpart.avatarUrl} alt={counterpart.name} />
          )}
          <AvatarFallback className="text-[10px]">
            {counterpart.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm md:max-w-[65%]",
          isMine
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm bg-card text-foreground border border-border",
        )}
      >
        <p className="whitespace-pre-wrap break-words leading-relaxed">
          {message.text}
        </p>
        <div
          className={cn(
            "mt-1 flex items-center gap-1 text-[10px]",
            isMine ? "justify-end text-primary-foreground/80" : "text-muted-foreground",
          )}
        >
          <span>{formatTime(message.sentAt)}</span>
          {isMine && <StatusIcon status={message.status} />}
        </div>
      </div>
    </div>
  );
}
