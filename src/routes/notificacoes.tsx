import { createFileRoute } from "@tanstack/react-router";
import { CheckCheck, Bell } from "lucide-react";
import { AuthGate } from "@/components/auth/AuthGate";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { NotificationFilters } from "@/components/notifications/NotificationFilters";
import { NotificationItem } from "@/components/notifications/NotificationItem";
import { useNotifications } from "@/providers/NotificationProvider";
import { analyticsService } from "@/services/analyticsService";

export const Route = createFileRoute("/notificacoes")({
  component: NotificationsPage,
  head: () => ({
    meta: [
      { title: "Notificações — LIT Buy" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content:
          "Central de notificações da LIT Buy: pedidos, mensagens, vendas, mediação e segurança.",
      },
    ],
  }),
});

function NotificationsPage() {
  const {
    visible,
    stats,
    filters,
    activeFilterId,
    setActiveFilterId,
    markAsRead,
    markAllAsRead,
    archive,
    loading,
  } = useNotifications();

  return (
    <AuthGate
      title="Entre para acessar suas notificações"
      description="Você precisa estar logado para ver a central de notificações."
    >
      <div className="container-lit space-y-6 py-6 md:py-10">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground md:text-3xl">
              <Bell className="h-6 w-6 text-primary" />
              Notificações
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {stats.unread} não lidas · {stats.total} no total (mock)
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={stats.unread === 0}
            onClick={() => {
              analyticsService.track("notification_all_read_mocked", {
                source: "page",
              });
              void markAllAsRead();
            }}
          >
            <CheckCheck className="h-4 w-4" /> Marcar todas como lidas
          </Button>
        </header>

        <NotificationFilters
          filters={filters}
          activeId={activeFilterId}
          onChange={setActiveFilterId}
        />

        {loading ? (
          <div className="h-40 animate-pulse rounded-2xl border border-border bg-card" />
        ) : visible.length === 0 ? (
          <EmptyState
            icon="Bell"
            title="Nada por aqui"
            description={
              activeFilterId === "all"
                ? "Você não tem notificações no momento."
                : "Nenhuma notificação para este filtro."
            }
            action={
              activeFilterId !== "all"
                ? { label: "Ver todas", onClick: () => setActiveFilterId("all") }
                : undefined
            }
          />
        ) : (
          <ul className="space-y-2">
            {visible.map((n) => (
              <li key={n.id}>
                <NotificationItem
                  notification={n}
                  onMarkRead={(id) => {
                    analyticsService.track("notification_marked_read_mocked", {
                      id,
                    });
                    void markAsRead(id);
                  }}
                  onArchive={archive}
                  onClick={(nn) => {
                    analyticsService.track("notification_clicked_mocked", {
                      id: nn.id,
                      type: nn.type,
                    });
                    if (nn.status === "unread") void markAsRead(nn.id);
                  }}
                />
              </li>
            ))}
          </ul>
        )}

        <p className="pt-4 text-[11px] text-muted-foreground">
          Notificações são visuais/mockadas. Envio real (push, e-mail, SMS)
          exigirá backend seguro, opt-in e infraestrutura de mensageria.
        </p>
      </div>
    </AuthGate>
  );
}
