import { Check, Lock } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SellerTeamPermission, SellerTeamRole } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  roles: SellerTeamRole[];
  permissions: SellerTeamPermission[];
}

export function SellerTeamPermissionsMatrix({ roles, permissions }: Props) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <header className="mb-3">
        <h3 className="text-base font-semibold text-foreground">Matriz de permissões</h3>
        <p className="text-xs text-muted-foreground">Visual — não bloqueia ações reais nesta fase.</p>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-2 pr-4">Permissão</th>
              {roles.map((r) => (
                <th key={r.id} className="py-2 px-2 text-center font-medium">{r.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions.map((p) => (
              <tr key={p.key} className="border-t border-border">
                <td className="py-2 pr-4">
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={cn("cursor-help text-sm font-medium", p.sensitive ? "text-warning" : "text-foreground")}>
                          {p.label}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{p.description}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </td>
                {roles.map((r) => {
                  const allowed = r.permissions.includes(p.key);
                  return (
                    <td key={r.id} className="px-2 py-2 text-center">
                      {allowed ? (
                        <Check className="mx-auto h-4 w-4 text-success" aria-label="Permitido" />
                      ) : (
                        <Lock className="mx-auto h-4 w-4 text-muted-foreground/50" aria-label="Bloqueado" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
