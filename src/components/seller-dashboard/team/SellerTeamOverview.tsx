import { Clock, ShieldCheck, UserCheck, UserPlus, Users } from "lucide-react";
import type { SellerTeamInvite, SellerTeamMember } from "@/types";

interface Props {
  members: SellerTeamMember[];
  invites: SellerTeamInvite[];
}

export function SellerTeamOverview({ members, invites }: Props) {
  const active = members.filter((m) => m.status === "active").length;
  const suspended = members.filter((m) => m.status === "suspended").length;

  const cards = [
    { icon: Users, label: "Membros", value: String(members.length), tone: "text-primary bg-primary/10" },
    { icon: UserCheck, label: "Ativos", value: String(active), tone: "text-success bg-success/10" },
    { icon: Clock, label: "Convites pendentes", value: String(invites.length), tone: "text-warning bg-warning/10" },
    { icon: ShieldCheck, label: "Suspensos", value: String(suspended), tone: "text-muted-foreground bg-muted/30" },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <span className={`grid h-9 w-9 place-items-center rounded-xl ${c.tone}`}>
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <div className="text-[10px] uppercase text-muted-foreground">{c.label}</div>
                <div className="text-lg font-semibold text-foreground">{c.value}</div>
              </div>
            </div>
          </div>
        );
      })}
      <p className="col-span-full text-[11px] text-muted-foreground">
        <UserPlus className="mr-1 inline h-3 w-3" /> Total é visual. Nada é persistido.
      </p>
    </section>
  );
}
