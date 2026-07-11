import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { cn } from "@/lib/utils";
import type { UserMessagePreview } from "@/types";

interface RecentMessagesCardProps {
  messages: UserMessagePreview[];
  loading?: boolean;
  className?: string;
  hideHeader?: boolean;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function RecentMessagesCard({
  messages,
  loading = false,
  className,
  hideHeader,
}: RecentMessagesCardProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card p-5 shadow-card md:p-6",
        className,
      )}
      aria-label="Mensagens recentes"
    >
      {!hideHeader && (
        <header className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Mensagens recentes
            </h3>
            <p className="text-xs text-muted-foreground">
              Conversas com vendedores.
            </p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/mensagens">
              Ver todas <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </header>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : messages.length === 0 ? (
        <EmptyState
          icon="MessageSquare"
          title="Nenhuma mensagem"
          description="Quando um vendedor te responder, a conversa aparecerá aqui."
        />
      ) : (
        <ul className="divide-y divide-border">
          {messages.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
            >
              <Avatar className="h-10 w-10 border border-border">
                {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt={m.sellerName} />}
                <AvatarFallback className="text-xs">
                  {m.sellerName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-foreground">
                    {m.sellerName}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {timeAgo(m.lastMessageAt)}
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {m.lastMessage}
                </p>
              </div>
              {m.unreadCount > 0 && (
                <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                  {m.unreadCount}
                </span>
              )}
              <Button
                asChild
                size="sm"
                variant="ghost"
                className="shrink-0"
              >
                <Link to="/mensagens">Abrir</Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
