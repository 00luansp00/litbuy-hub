import { EmptyState } from "@/components/common/EmptyState";
import { ConversationListItem } from "./ConversationListItem";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/types";

interface Props {
  conversations: Conversation[];
  activeId?: string;
  className?: string;
}

export function ConversationsList({
  conversations,
  activeId,
  className,
}: Props) {
  if (conversations.length === 0) {
    return (
      <div className={cn("p-4", className)}>
        <EmptyState
          icon="MessageSquare"
          title="Sem conversas"
          description="Quando você iniciar uma conversa com um vendedor, ela aparecerá aqui."
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-y-auto",
        className,
      )}
      aria-label="Lista de conversas"
    >
      <header className="border-b border-border bg-card/60 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Conversas</h2>
        <p className="text-[11px] text-muted-foreground">
          {conversations.length} conversas · demonstração
        </p>
      </header>
      <div>
        {conversations.map((c) => (
          <ConversationListItem
            key={c.id}
            conversation={c}
            active={c.id === activeId}
          />
        ))}
      </div>
    </div>
  );
}
