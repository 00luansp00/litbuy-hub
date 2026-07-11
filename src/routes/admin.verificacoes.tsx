import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, Check, X, Info, Flag } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminDashboardSection } from "@/components/admin/AdminDashboardSection";
import { AdminRiskBadge } from "@/components/admin/AdminRiskBadge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminAdvancedService } from "@/services/adminAdvancedService";
import type { AdminKycReview } from "@/types";

export const Route = createFileRoute("/admin/verificacoes")({
  component: AdminKycPage,
});

const STATUS_LABEL: Record<AdminKycReview["status"], string> = {
  pending_review: "Em análise",
  needs_more_info: "Precisa de info",
  approved: "Aprovado",
  rejected: "Recusado",
};

function AdminKycPage() {
  const [rows, setRows] = useState<AdminKycReview[]>([]);
  useEffect(() => {
    adminAdvancedService.getKycQueue().then(setRows);
  }, []);

  const decide = (id: string, next: AdminKycReview["status"]) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: next } : r)));
    toast.success("Decisão registrada (mock)");
  };

  return (
    <AdminLayout title="Fila de verificações (KYC)" description="Aprovar, recusar ou pedir mais informações — visual.">
      <Alert className="border-warning/30 bg-warning/10">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <AlertTitle>KYC demonstrativo</AlertTitle>
        <AlertDescription className="text-xs">
          KYC real exige fornecedor especializado, backend seguro, LGPD e armazenamento protegido.
          Nenhum documento ou selfie é exibido aqui.
        </AlertDescription>
      </Alert>

      <AdminDashboardSection title="Aguardando revisão" description={`${rows.length} solicitações mockadas`}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Selfie</TableHead>
                <TableHead>Enviado</TableHead>
                <TableHead>Risco</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{r.userName}</div>
                    <div className="text-xs text-muted-foreground">{r.userEmail}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="uppercase">{r.documentType}</Badge>
                  </TableCell>
                  <TableCell>
                    {r.selfieProvided ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <X className="h-4 w-4 text-destructive" />
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(r.submittedAt), { locale: ptBR, addSuffix: true })}
                  </TableCell>
                  <TableCell><AdminRiskBadge risk={r.risk} /></TableCell>
                  <TableCell>
                    <Badge variant={r.status === "approved" ? "default" : "outline"}>
                      {STATUS_LABEL[r.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" onClick={() => decide(r.id, "approved")}>Aprovar</Button>
                    <Button size="sm" variant="outline" onClick={() => decide(r.id, "needs_more_info")}>
                      <Info className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => decide(r.id, "rejected")}>
                      Recusar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => toast("Marcado como suspeito (mock)")} aria-label="Suspeito">
                      <Flag className="h-3 w-3 text-warning" />
                    </Button>
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
