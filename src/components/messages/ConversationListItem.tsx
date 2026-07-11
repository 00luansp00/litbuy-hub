import { Link } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/types";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const TYPE_HINT: Record<Conversation["type"], string> = {
  pre_purchase: "Pré-compra",
  order_related: "Pedido",
  support: "Suporte",
};

interface Props {
  conversation: Conversation;
  active?: boolean;
}

export function ConversationListItem({ conversation, active }: Props) {
  const cp = conversation.counterpart;
  return (
    <Link
      to="/mensagens/$id"
      params={{ id: conversation.id }}
      className={cn(
        "flex items-start gap-3 border-b border-border px-3 py-3 transition-colors last:border-b-0 hover:bg-surface/60",
        active && "bg-surface",
      )}
    >
      <Avatar className="h-10 w-10 border border-border">
        {cp.avatarUrl && <AvatarImage src={cp.avatarUrl} alt={cp.name} />}
        <AvatarFallback className="text-xs">
          {cp.name.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {cp.name}
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {timeAgo(conversation.lastMessage.sentAt)}
          </span>
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {conversation.lastMessage.text}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <span className="rounded-full border border-border bg-surface/60 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
            {TYPE_HINT[conversation.type]}
          </span>
          {conversation.context.orderCode && (
            <span className="truncate text-[10px] text-muted-foreground">
              {conversation.context.orderCode}
            </span>
          )}
        </div>
      </div>
      {conversation.unreadCount > 0 && (
        <span className="ml-1 mt-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
          {conversation.unreadCount}
        </span>
      )}
    </Link>
  );
}
