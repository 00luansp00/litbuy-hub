import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface AdminAction {
  label: string;
  /** Mensagem exibida no toast quando a ação é acionada. */
  toastLabel?: string;
  destructive?: boolean;
}

interface AdminActionMenuProps {
  label?: string;
  actions: AdminAction[];
}

export function AdminActionMenu({ label = "Ações", actions }: AdminActionMenuProps) {
  const trigger = (a: AdminAction) => {
    toast(a.toastLabel ?? a.label, {
      description:
        "Ação administrativa disponível apenas na versão com backend. Nenhuma alteração real foi feita.",
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={label}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {actions.map((a) => (
          <DropdownMenuItem
            key={a.label}
            onSelect={() => trigger(a)}
            className={a.destructive ? "text-destructive focus:text-destructive" : undefined}
          >
            {a.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
