import {
  Bell,
  CreditCard,
  Flag,
  Gavel,
  HelpCircle,
  MessageSquare,
  PackageCheck,
  PackageSearch,
  Receipt,
  Shield,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Notification, NotificationPriority } from "@/types";

const TYPE_ICON: Record<Notification["type"], React.ComponentType<{ className?: string }>> = {
  order: Receipt,
  payment: CreditCard,
  delivery: PackageCheck,
  message: MessageSquare,
  mediation: Gavel,
  sale: ShoppingBag,
  listing: PackageSearch,
  wallet: Wallet,
  kyc: ShieldAlert,
  report: Flag,
  security: ShieldAlert,
  admin: Shield,
  system: HelpCircle,
  reward: Sparkles,
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
  const type = notification.type ?? "system";
  const Icon = TYPE_ICON[type] ?? Bell;
  const tone = PRIORITY_TONE[notification.priority] ?? PRIORITY_TONE.medium;

  return (
    <div
      className={cn(
        "grid h-9 w-9 place-items-center rounded-lg border border-border bg-surface",
        className,
      )}
    >
      <Icon className={cn("h-4 w-4", tone)} />
    </div>
  );
}
