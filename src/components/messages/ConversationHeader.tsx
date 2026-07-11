import { Link } from "@tanstack/react-router";
import { ArrowLeft, BadgeCheck, MoreVertical } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Conversation } from "@/types";

const TYPE_LABELS: Record<Conversation["type"], string> = {
  pre_purchase: "Pré-compra",
  order_related: "Sobre pedido",
  support: "Suporte",
};

export function ConversationHeader({
  conversation,
}: {
  conversation: Conversation;
}) {
  const cp = conversation.counterpart;
  return (
    <header className="flex items-center gap-3 border-b border-border bg-card/60 p-3 md:p-4">
      <Button
        asChild
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Voltar para conversas"
      >
        <Link to="/mensagens">
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </Button>

      <Avatar className="h-10 w-10 border border-border">
        {cp.avatarUrl && <AvatarImage src={cp.avatarUrl} alt={cp.name} />}
        <AvatarFallback className="text-xs">
          {cp.name.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-foreground">
            {cp.name}
          </span>
          {cp.verified && (
            <BadgeCheck className="h-4 w-4 shrink-0 text-primary" aria-label="Verificado" />
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
            {TYPE_LABELS[conversation.type]}
          </Badge>
          {cp.sellerSlug && (
            <Link
              to="/loja/$slug"
              params={{ slug: cp.sellerSlug }}
              className="hover:text-foreground"
            >
              Ver loja
            </Link>
          )}
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon"
        aria-label="Mais opções"
        onClick={(e) => e.preventDefault()}
      >
        <MoreVertical className="h-4 w-4" />
      </Button>
    </header>
  );
}
