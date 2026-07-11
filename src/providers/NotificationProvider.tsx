import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { notificationService } from "@/services/notificationService";
import { useAuth } from "@/providers/AuthProvider";
import type {
  Notification,
  NotificationFilter,
  NotificationRole,
  NotificationStats,
} from "@/types";

interface NotificationContextValue {
  notifications: Notification[];
  visible: Notification[];
  unreadCount: number;
  stats: NotificationStats;
  filters: NotificationFilter[];
  activeFilterId: string;
  setActiveFilterId: (id: string) => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  archive: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
  roles: NotificationRole[];
  loading: boolean;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { activeRole, isAdmin, isAuthenticated } = useAuth();
  const roles = useMemo<NotificationRole[]>(() => {
    const arr: NotificationRole[] = ["all"];
    arr.push(activeRole === "seller" ? "seller" : "buyer");
    if (isAdmin) arr.push("admin");
    return arr;
  }, [activeRole, isAdmin]);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeFilterId, setActiveFilterId] = useState<string>("all");
  const [loading, setLoading] = useState(false);

  const filters = useMemo(
    () => notificationService.getNotificationFilters(),
    [],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await notificationService.getNotificationsByRole(roles);
    setNotifications(
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
    setLoading(false);
  }, [roles]);

  useEffect(() => {
    if (!isAuthenticated) {
      // Mesmo sem login, mostramos algumas notificações "all"
      // para não deixar o sino vazio na demo.
      void refresh();
      return;
    }
    void refresh();
  }, [isAuthenticated, refresh]);

  const markAsRead = useCallback(async (id: string) => {
    await notificationService.simulateMarkAsRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status: "read" } : n)),
    );
  }, []);

  const markAllAsRead = useCallback(async () => {
    await notificationService.simulateMarkAllAsRead(roles);
    setNotifications((prev) =>
      prev.map((n) => (n.status === "unread" ? { ...n, status: "read" } : n)),
    );
  }, [roles]);

  const archive = useCallback(async (id: string) => {
    await notificationService.simulateArchiveNotification(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status: "archived" } : n)),
    );
  }, []);

  const visible = useMemo(() => {
    const list = notifications.filter((n) => n.status !== "archived");
    const filter = filters.find((f) => f.id === activeFilterId);
    if (!filter || filter.id === "all") return list;
    return list.filter((n) => {
      if (filter.onlyUnread && n.status !== "unread") return false;
      if (filter.types && !filter.types.includes(n.type)) return false;
      return true;
    });
  }, [notifications, filters, activeFilterId]);

  const stats = useMemo<NotificationStats>(() => {
    const active = notifications.filter((n) => n.status !== "archived");
    const byType: NotificationStats["byType"] = {};
    const byPriority: NotificationStats["byPriority"] = {};
    let unread = 0;
    for (const n of active) {
      byType[n.type] = (byType[n.type] ?? 0) + 1;
      byPriority[n.priority] = (byPriority[n.priority] ?? 0) + 1;
      if (n.status === "unread") unread++;
    }
    return { total: active.length, unread, byType, byPriority };
  }, [notifications]);

  const value: NotificationContextValue = {
    notifications,
    visible,
    unreadCount: stats.unread,
    stats,
    filters,
    activeFilterId,
    setActiveFilterId,
    markAsRead,
    markAllAsRead,
    archive,
    refresh,
    roles,
    loading,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx)
    throw new Error(
      "useNotifications deve ser usado dentro de <NotificationProvider>",
    );
  return ctx;
}
