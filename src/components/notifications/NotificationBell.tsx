import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, CheckCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/common/EmptyState";
import { useNotifications } from "@/providers/NotificationProvider";
import { analyticsService } from "@/services/analyticsService";
import { NotificationItem } from "./NotificationItem";

/**
 * NotificationBell — sino da Navbar.
 *
 * Desktop: abre um dropdown com as últimas notificações.
 * Mobile: navega diretamente para /notificacoes.
 */
export function NotificationBell({ compact = false }: { compact?: boolean }) {
  const { visible, unreadCount, markAsRead, markAllAsRead } =
    useNotifications();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const recent = visible.slice(0, 6);
  const badgeText = unreadCount > 99 ? "99+" : String(unreadCount);

  if (compact) {
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Notificações (${unreadCount} não lidas)`}
        className="relative"
        onClick={() => {
          analyticsService.track("notification_opened_mocked", {
            source: "navbar-mobile",
          });
          void navigate({ to: "/notificacoes" });
        }}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge className="absolute -top-1 -right-1 h-4 min-w-4 border-0 bg-primary px-1 text-[10px]">
            {badgeText}
          </Badge>
        )}
      </Button>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Notificações (${unreadCount} não lidas)`}
          className="relative"
          onClick={() =>
            analyticsService.track("notification_opened_mocked", {
              source: "navbar",
            })
          }
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 border-0 bg-primary px-1 text-[10px]">
              {badgeText}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[360px] max-w-[92vw] p-0"
      >
        <div className="flex items-center justify-between border-b border-border p-3">
          <div>
            <p className="text-sm font-semibold text-foreground">
              Notificações
            </p>
            <p className="text-[11px] text-muted-foreground">
              {unreadCount} não lidas
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="text-[11px]"
            onClick={() => {
              analyticsService.track("notification_all_read_mocked");
              void markAllAsRead();
            }}
            disabled={unreadCount === 0}
          >
            <CheckCheck className="h-3.5 w-3.5" /> Marcar todas
          </Button>
        </div>

        <div className="max-h-[420px] space-y-2 overflow-y-auto p-2">
          {recent.length === 0 ? (
            <EmptyState
              icon="Bell"
              title="Sem notificações"
              description="Você está em dia. Novos eventos aparecerão aqui."
            />
          ) : (
            recent.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                compact
                onClick={() => {
                  analyticsService.track("notification_clicked_mocked", {
                    id: n.id,
                    type: n.type,
                  });
                  void markAsRead(n.id);
                  setOpen(false);
                }}
              />
            ))
          )}
        </div>

        <div className="border-t border-border p-2">
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link to="/notificacoes" onClick={() => setOpen(false)}>
              Ver todas
            </Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
