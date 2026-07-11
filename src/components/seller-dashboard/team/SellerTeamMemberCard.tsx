import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { sellerTeamService } from "@/services/sellerTeamService";
import type { SellerTeamMember, SellerTeamRole } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  member: SellerTeamMember;
  role?: SellerTeamRole;
}

const STATUS_TONE: Record<SellerTeamMember["status"], string> = {
  active: "text-success bg-success/10",
  pending: "text-warning bg-warning/10",
  suspended: "text-destructive bg-destructive/10",
};

const STATUS_LABEL: Record<SellerTeamMember["status"], string> = {
  active: "Ativo",
  pending: "Pendente",
  suspended: "Suspenso",
};

export function SellerTeamMemberCard({ member, role }: Props) {
  const initials = member.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  const changeRole = async () => {
    await sellerTeamService.simulateUpdateMemberRole(member.id, member.roleId);
    toast.success("Cargo alterado (mock)");
  };
  const remove = async () => {
    await sellerTeamService.simulateRemoveMember(member.id);
    toast("Membro removido (mock)");
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="h-10 w-10 border border-border">
          {member.avatarUrl && <AvatarImage src={member.avatarUrl} alt={member.name} />}
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">{member.name}</p>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", STATUS_TONE[member.status])}>
              {STATUS_LABEL[member.status]}
            </span>
          </div>
          <p className="truncate text-xs text-muted-foreground">{member.email}</p>
          {role && (
            <p className="text-[11px] text-muted-foreground">Cargo: <strong className="text-foreground">{role.name}</strong></p>
          )}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Ações do membro">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={changeRole}>Alterar cargo (mock)</DropdownMenuItem>
          <DropdownMenuItem onClick={() => toast("Reenviar convite (mock)")}>Reenviar convite</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive" onClick={remove}>
            Remover membro
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
