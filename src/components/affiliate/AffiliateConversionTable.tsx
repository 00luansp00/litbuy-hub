import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBRL } from "@/lib/format";
import type {
  AffiliateCommissionStatus,
  AffiliateConversion,
  AffiliateConversionType,
} from "@/types";

const TYPE_LABEL: Record<AffiliateConversionType, string> = {
  signup: "Cadastro",
  first_purchase: "1ª compra",
  first_sale: "1ª venda",
  recurring_sale: "Venda recorrente",
  special_campaign: "Campanha especial",
};

const STATUS_TONE: Record<AffiliateCommissionStatus, string> = {
  pending: "border-warning/40 text-warning",
  available: "border-success/40 text-success",
  paid: "border-primary/40 text-primary",
  cancelled: "border-muted text-muted-foreground",
  reversed: "border-destructive/40 text-destructive",
};

const STATUS_LABEL: Record<AffiliateCommissionStatus, string> = {
  pending: "Pendente",
  available: "Disponível",
  paid: "Paga",
  cancelled: "Cancelada",
  reversed: "Estornada",
};

export function AffiliateConversionTable({
  conversions,
}: {
  conversions: AffiliateConversion[];
}) {
  if (conversions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface/40 p-6 text-center text-sm text-muted-foreground">
        Nenhuma conversão registrada ainda (mock).
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Usuário indicado</TableHead>
            <TableHead>Venda</TableHead>
            <TableHead>Comissão</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {conversions.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="text-xs text-muted-foreground">
                {new Date(c.createdAt).toLocaleDateString("pt-BR")}
              </TableCell>
              <TableCell className="text-sm">{TYPE_LABEL[c.type]}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {c.referredUserMasked}
              </TableCell>
              <TableCell className="text-sm">
                {c.saleAmount ? formatBRL(c.saleAmount) : "—"}
              </TableCell>
              <TableCell className="text-sm font-medium text-foreground">
                {formatBRL(c.commissionAmount)}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={STATUS_TONE[c.commissionStatus]}>
                  {STATUS_LABEL[c.commissionStatus]}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
