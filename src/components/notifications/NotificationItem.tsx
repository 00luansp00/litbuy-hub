import { useRouter } from "@tanstack/react-router";
import { Check, Archive } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NotificationTypeIcon } from "./NotificationTypeIcon";
import { NotificationPriorityBadge } from "./NotificationPriorityBadge";
import type { Notification } from "@/types";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

interface Props {
  notification: Notification;
  onMarkRead?: (id: string) => void;
  onArchive?: (id: string) => void;
  onClick?: (n: Notification) => void;
  compact?: boolean;
}

export function NotificationItem({
  notification,
  onMarkRead,
  onArchive,
  onClick,
  compact,
}: Props) {
  const router = useRouter();
  const unread = notification.status === "unread";

  const handleActivate = () => {
    onClick?.(notification);
    if (notification.href) {
      void router.navigate({ to: notification.href });
    }
  };

  const wrapperClass = cn(
    "block cursor-pointer rounded-xl border border-border bg-card p-3 text-left transition-colors hover:bg-surface/60",
    unread && "border-primary/30 bg-primary/[0.03]",
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleActivate();
        }
      }}
      className={wrapperClass}
    >
      <div className="flex items-start gap-3">
        <NotificationTypeIcon notification={notification} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "truncate text-sm font-medium",
                unread ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {notification.title}
            </span>
            {unread && (
              <span
                aria-label="Não lida"
                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
              />
            )}
            {!compact && (
              <NotificationPriorityBadge priority={notification.priority} />
            )}
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {notification.description}
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            {timeAgo(notification.createdAt)}
          </p>
        </div>
        {!compact && (
          <div className="flex shrink-0 flex-col items-end gap-1">
            {unread && onMarkRead && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px]"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onMarkRead(notification.id);
                }}
                aria-label="Marcar como lida"
              >
                <Check className="h-3 w-3" />
              </Button>
            )}
            {onArchive && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px]"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onArchive(notification.id);
                }}
                aria-label="Arquivar"
              >
                <Archive className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

