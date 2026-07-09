import { motion } from "motion/react";
import {
  BadgeCheck,
  Crown,
  HeadphonesIcon,
  Medal,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SellerBadge, SellerBadgeKind } from "@/types";

interface SellerBadgesProps {
  badges: SellerBadge[];
  className?: string;
}

const BADGE_META: Record<
  SellerBadgeKind,
  { icon: typeof BadgeCheck; tone: string }
> = {
  verified: { icon: BadgeCheck, tone: "text-accent bg-accent/12" },
  top_seller: { icon: Crown, tone: "text-warning bg-warning/12" },
  instant_delivery: { icon: Zap, tone: "text-warning bg-warning/12" },
  fast_reply: { icon: MessageSquare, tone: "text-primary bg-primary/12" },
  premium_member: { icon: Sparkles, tone: "text-primary bg-primary/12" },
  high_rep: { icon: Medal, tone: "text-success bg-success/12" },
  active_support: { icon: HeadphonesIcon, tone: "text-accent bg-accent/12" },
};

/**
 * SellerBadges — grade de badges de confiança concedidas pela plataforma.
 */
export function SellerBadges({ badges, className }: SellerBadgesProps) {
  if (badges.length === 0) return null;

  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card p-5 md:p-6",
        className,
      )}
      aria-label="Badges do vendedor"
    >
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
        <ShieldCheck className="h-4 w-4 text-success" />
        Selos de confiança
      </h2>

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {badges.map((badge, i) => {
          const meta = BADGE_META[badge.kind];
          const Icon = meta.icon;
          return (
            <motion.li
              key={badge.kind}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.28, delay: Math.min(i * 0.04, 0.24) }}
              className="flex items-start gap-3 rounded-xl border border-border bg-surface/50 p-3"
            >
              <span
                className={cn(
                  "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
                  meta.tone,
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {badge.label}
                </p>
                {badge.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {badge.description}
                  </p>
                )}
              </div>
            </motion.li>
          );
        })}
      </ul>
    </section>
  );
}
