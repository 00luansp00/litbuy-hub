import type { SellerTeamMember, SellerTeamRole } from "@/types";
import { SellerTeamMemberCard } from "./SellerTeamMemberCard";

interface Props {
  members: SellerTeamMember[];
  roles: SellerTeamRole[];
}

export function SellerTeamMembersList({ members, roles }: Props) {
  const roleById = new Map(roles.map((r) => [r.id, r] as const));
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <header className="mb-3">
        <h3 className="text-base font-semibold text-foreground">Membros da equipe</h3>
        <p className="text-xs text-muted-foreground">Cargos e permissões são apenas visuais.</p>
      </header>
      <div className="space-y-2">
        {members.map((m) => (
          <SellerTeamMemberCard key={m.id} member={m} role={roleById.get(m.roleId)} />
        ))}
      </div>
    </section>
  );
}
