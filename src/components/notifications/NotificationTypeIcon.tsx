import { DynamicIcon } from "lucide-react/dynamic";
import type { Notification, NotificationPriority } from "@/types";

const TYPE_ICON: Record<Notification["type"], string> = {
  order: "receipt",
  payment: "credit-card",
  delivery: "package-check",
  message: "message-square",
  mediation: "gavel",
  sale: "shopping-bag",
  listing: "package-search",
  wallet: "wallet",
  kyc: "badge-check",
  report: "flag",
  security: "shield-alert",
  admin: "shield",
  system: "info",
  reward: "sparkles",
};

const PRIORITY_TONE: Record<NotificationPriority, string> = {
  low: "text-muted-foreground",
  medium: "text-primary",
  high: "text-warning",
  critical: "text-destructive",
};

export function NotificationTypeIcon({
  notification,
  className,
}: {
  notification: Notification;
  className?: string;
}) {
  const iconName = (notification.icon
    ? notification.icon
        .replace(/([a-z])([A-Z])/g, "$1-$2")
        .toLowerCase()
    : TYPE_ICON[notification.type]) as Parameters<typeof DynamicIcon>[0]["name"];

  return (
    <div
      className={
        "grid h-9 w-9 place-items-center rounded-lg border border-border bg-surface " +
        (className ?? "")
      }
    >
      <DynamicIcon
        name={iconName}
        className={"h-4 w-4 " + PRIORITY_TONE[notification.priority]}
      />
    </div>
  );
}
