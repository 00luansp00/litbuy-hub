import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminDashboardSection } from "@/components/admin/AdminDashboardSection";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminAdvancedService } from "@/services/adminAdvancedService";
import type { AdminAuditLogEntry } from "@/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/auditoria")({
  component: AdminAuditPage,
});

const SEV_TONE = {
  info: "text-primary bg-primary/10",
  warning: "text-warning bg-warning/10",
  critical: "text-destructive bg-destructive/10",
} as const;

function AdminAuditPage() {
  const [rows, setRows] = useState<AdminAuditLogEntry[]>([]);
  useEffect(() => {
    adminAdvancedService.getAuditLog().then(setRows);
  }, []);

  return (
    <AdminLayout
      title="Audit log"
      description="Histórico visual de ações — mockado. Auditoria real vive no backend."
    >
      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Audit log demonstrativo</AlertTitle>
        <AlertDescription className="text-xs">
          Em produção, todas as ações administrativas sensíveis (saque, taxa, permissão, KYC) devem
          gerar registros imutáveis com ator, entidade, antes/depois, IP e resultado.
        </AlertDescription>
      </Alert>

      <AdminDashboardSection title="Eventos recentes">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Ator</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Entidade</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Severidade</TableHead>
                <TableHead>Resultado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(r.date), { locale: ptBR, addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-foreground">{r.actor}</div>
                    <div className="text-xs text-muted-foreground">{r.actorRole}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-foreground">{r.action}</div>
                    {r.summary && <div className="text-xs text-muted-foreground">{r.summary}</div>}
                  </TableCell>
                  <TableCell className="text-xs">{r.entity}</TableCell>
                  <TableCell className="font-mono text-xs">{r.ip}</TableCell>
                  <TableCell>
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", SEV_TONE[r.severity])}>
                      {r.severity === "critical" && <AlertTriangle className="h-3 w-3" />}
                      {r.severity}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.result === "ok" ? "default" : "destructive"}>
                      {r.result === "ok" && <CheckCircle2 className="mr-1 h-3 w-3" />}
                      {r.result}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </AdminDashboardSection>
    </AdminLayout>
  );
}
