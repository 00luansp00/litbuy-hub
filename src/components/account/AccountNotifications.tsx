import { motion } from "motion/react";
import { icons, Bell, HelpCircle } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { cn } from "@/lib/utils";
import type { AccountNotification, AccountNotificationTone } from "@/types";

interface AccountNotificationsProps {
  notifications: AccountNotification[];
  className?: string;
}

const TONE: Record<AccountNotificationTone, string> = {
  info: "text-primary bg-primary/12 border-primary/20",
  success: "text-success bg-success/12 border-success/20",
  warning: "text-warning bg-warning/12 border-warning/20",
  danger: "text-destructive bg-destructive/12 border-destructive/20",
};

export function AccountNotifications({
  notifications,
  className,
}: AccountNotificationsProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card p-5 shadow-card md:p-6",
        className,
      )}
      aria-label="Alertas da conta"
    >
      <header className="mb-4 flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/12 text-primary">
          <Bell className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Alertas da conta
          </h3>
          <p className="text-xs text-muted-foreground">
            Ações rápidas para manter tudo em ordem.
          </p>
        </div>
      </header>

      {notifications.length === 0 ? (
        <EmptyState
          icon="Bell"
          title="Sem alertas"
          description="Tudo em dia por aqui. Quando surgir algo importante avisamos."
        />
      ) : (
        <ul className="space-y-3">
          {notifications.map((n, i) => {
            const Icon =
              (icons as Record<string, React.ComponentType<{ className?: string }>>)[
                n.icon
              ] ?? HelpCircle;
            return (
              <motion.li
                key={n.id}
                initial={{ opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.25, delay: Math.min(i * 0.05, 0.2) }}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-3",
                  TONE[n.tone],
                )}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {n.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {n.description}
                  </p>
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
