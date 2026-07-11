import { motion } from "motion/react";
import { icons, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SellerNotification, SellerNotificationTone } from "@/types";

const TONE: Record<SellerNotificationTone, string> = {
  info: "border-primary/30 bg-primary/5 text-primary",
  success: "border-success/30 bg-success/5 text-success",
  warning: "border-warning/30 bg-warning/5 text-warning",
  danger: "border-destructive/30 bg-destructive/5 text-destructive",
};

interface SellerNotificationsCardProps {
  notifications: SellerNotification[];
}

export function SellerNotificationsCard({ notifications }: SellerNotificationsCardProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl border border-border bg-card p-5 shadow-card"
    >
      <header className="mb-4 flex items-center gap-2">
        <Bell className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-lg font-bold text-foreground">Alertas da conta</h3>
      </header>

      {notifications.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nada por aqui. Tudo em ordem.</p>
      ) : (
        <ul className="space-y-2.5">
          {notifications.map((n) => {
            const Icon =
              (icons as Record<string, React.ComponentType<{ className?: string }>>)[
                n.icon
              ] ?? Bell;
            return (
              <li
                key={n.id}
                className={cn("flex gap-3 rounded-xl border p-3", TONE[n.tone])}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-background/60">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground">{n.title}</div>
                  <div className="text-xs text-muted-foreground">{n.description}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </motion.section>
  );
}
