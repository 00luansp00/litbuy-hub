import { Crown, HeadphonesIcon, ShieldCheck, Truck, Wallet } from "lucide-react";
import type { SellerTeamRole } from "@/types";
import { cn } from "@/lib/utils";

const ICON: Record<SellerTeamRole["id"], typeof Crown> = {
  owner: Crown,
  manager: ShieldCheck,
  attendant: HeadphonesIcon,
  delivery: Truck,
  finance: Wallet,
};

const TONE: Record<SellerTeamRole["tone"], string> = {
  primary: "text-primary bg-primary/10",
  accent: "text-accent bg-accent/10",
  success: "text-success bg-success/10",
  warning: "text-warning bg-warning/10",
  muted: "text-muted-foreground bg-muted/30",
};

export function SellerTeamRolesCards({ roles }: { roles: SellerTeamRole[] }) {
  return (
    <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {roles.map((r) => {
        const Icon = ICON[r.id];
        return (
          <article key={r.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <span className={cn("grid h-9 w-9 place-items-center rounded-xl", TONE[r.tone])}>
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <h4 className="text-sm font-semibold text-foreground">{r.name}</h4>
                <p className="text-[11px] text-muted-foreground">{r.permissions.length} permissões</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{r.description}</p>
          </article>
        );
      })}
    </section>
  );
}
