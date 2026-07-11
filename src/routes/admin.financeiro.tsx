import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminDashboardSection } from "@/components/admin/AdminDashboardSection";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminAdvancedService } from "@/services/adminAdvancedService";
import type {
  AdminFeeConfig,
  AdminLitPointsConfig,
  AdminPaymentMethodRow,
  AdminPlanBenefitConfig,
  AdminSellerLevelConfigRow,
} from "@/types";

export const Route = createFileRoute("/admin/financeiro")({
  component: AdminFinanceiroPage,
});

function AdminFinanceiroPage() {
  const [fees, setFees] = useState<AdminFeeConfig[]>([]);
  const [methods, setMethods] = useState<AdminPaymentMethodRow[]>([]);
  const [points, setPoints] = useState<AdminLitPointsConfig | null>(null);
  const [levels, setLevels] = useState<AdminSellerLevelConfigRow[]>([]);
  const [plans, setPlans] = useState<AdminPlanBenefitConfig[]>([]);

  useEffect(() => {
    adminAdvancedService.getFees().then(setFees);
    adminAdvancedService.getPaymentMethods().then(setMethods);
    adminAdvancedService.getLitPointsConfig().then(setPoints);
    adminAdvancedService.getSellerLevelConfigs().then(setLevels);
    adminAdvancedService.getPlans().then(setPlans);
  }, []);

  return (
    <AdminLayout
      title="Financeiro e monetização"
      description="Taxas, pagamentos, LIT Points, níveis e planos — visual/mockado."
      actions={
        <Button size="sm" variant="outline" onClick={() => toast("Pausar saques (mock)")}>
          Pausar saques
        </Button>
      }
    >
      <Alert className="border-warning/30 bg-warning/10">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <AlertTitle>Nenhuma alteração real</AlertTitle>
        <AlertDescription className="text-xs">
          Taxas, pagamentos, pontos e saldos exibidos são <strong>mockados</strong>. Não afetam
          usuários, gateways ou wallet. Configuração real deve viver no backend com auditoria.
        </AlertDescription>
      </Alert>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <BalanceCard label="Receita 30d (demo)" value="R$ 84.320,00" tone="text-success" />
        <BalanceCard label="Saldo pendente" value="R$ 128.400,00" tone="text-warning" />
        <BalanceCard label="Saldo disponível" value="R$ 42.100,00" tone="text-primary" />
        <BalanceCard label="Bloqueado por disputa" value="R$ 6.820,00" tone="text-destructive" />
      </div>

      <Tabs defaultValue="fees">
        <TabsList>
          <TabsTrigger value="fees">Taxas</TabsTrigger>
          <TabsTrigger value="methods">Pagamentos</TabsTrigger>
          <TabsTrigger value="points">LIT Points</TabsTrigger>
          <TabsTrigger value="levels">Níveis</TabsTrigger>
          <TabsTrigger value="plans">Planos</TabsTrigger>
        </TabsList>

        <TabsContent value="fees">
          <AdminDashboardSection title="Taxas da plataforma">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Taxa</TableHead>
                    <TableHead>Percentual</TableHead>
                    <TableHead>Fixo</TableHead>
                    <TableHead>Ativa</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fees.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell>
                        <div className="font-medium text-foreground">{f.label}</div>
                        {f.note && <div className="text-xs text-muted-foreground">{f.note}</div>}
                      </TableCell>
                      <TableCell>{f.percent}%</TableCell>
                      <TableCell>{f.fixed ? `R$ ${f.fixed.toFixed(2)}` : "—"}</TableCell>
                      <TableCell>
                        <Switch checked={f.active} onCheckedChange={() => {
                          setFees((p) => p.map((x) => x.id === f.id ? { ...x, active: !x.active } : x));
                          toast("Taxa alternada (mock)");
                        }} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => toast("Editar taxa (mock)")}>Editar</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </AdminDashboardSection>
        </TabsContent>

        <TabsContent value="methods">
          <AdminDashboardSection title="Métodos de pagamento">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Método</TableHead>
                    <TableHead>Taxa</TableHead>
                    <TableHead>Min / Máx</TableHead>
                    <TableHead>Expira</TableHead>
                    <TableHead>Ambiente</TableHead>
                    <TableHead>Ativo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {methods.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell>{m.feePercent}%</TableCell>
                      <TableCell className="text-xs">R$ {m.minValue} — R$ {m.maxValue}</TableCell>
                      <TableCell className="text-xs">{m.expirationHours ? `${m.expirationHours}h` : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={m.environment === "demo" ? "outline" : "secondary"}>{m.environment}</Badge>
                      </TableCell>
                      <TableCell>
                        <Switch checked={m.active} onCheckedChange={() => {
                          setMethods((p) => p.map((x) => x.id === m.id ? { ...x, active: !x.active } : x));
                          toast("Método alternado (mock)");
                        }} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </AdminDashboardSection>
        </TabsContent>

        <TabsContent value="points">
          {points && (
            <AdminDashboardSection title="LIT Points" description="Regras e cotação demonstrativa.">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                <ConfigField label="Programa ativo" value={<Switch checked={points.active} onCheckedChange={() => setPoints({ ...points, active: !points.active })} />} />
                <ConfigField label="Pontos por compra" value={points.pointsPerPurchase} />
                <ConfigField label="Pontos por venda" value={points.pointsPerSale} />
                <ConfigField label="Pontos por avaliação" value={points.pointsPerReview} />
                <ConfigField label="Bônus por campanha" value={points.campaignBonus} />
                <ConfigField label="Validade (dias)" value={points.expirationDays} />
                <ConfigField label="Uso máx. por pedido" value={`${points.maxUsePercentPerOrder}%`} />
                <ConfigField label="Cotação (R$/ponto)" value={`R$ ${points.quote.toFixed(2)}`} />
              </div>
            </AdminDashboardSection>
          )}
        </TabsContent>

        <TabsContent value="levels">
          <AdminDashboardSection title="Níveis de vendedor">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nível</TableHead>
                    <TableHead>Vendas mín.</TableHead>
                    <TableHead>Aval. mín.</TableHead>
                    <TableHead>Disputa máx.</TableHead>
                    <TableHead>Taxa</TableHead>
                    <TableHead>Liberação</TableHead>
                    <TableHead>Ativo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {levels.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.name}</TableCell>
                      <TableCell>{l.minSales}</TableCell>
                      <TableCell>★ {l.minRating}</TableCell>
                      <TableCell>{l.maxDisputeRate}%</TableCell>
                      <TableCell>{l.platformFeePercent}%</TableCell>
                      <TableCell>{l.releaseHours}h</TableCell>
                      <TableCell>
                        <Switch checked={l.active} onCheckedChange={() => {
                          setLevels((p) => p.map((x) => x.id === l.id ? { ...x, active: !x.active } : x));
                          toast("Nível alternado (mock)");
                        }} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </AdminDashboardSection>
        </TabsContent>

        <TabsContent value="plans">
          <AdminDashboardSection title="LIT-MAX e planos Prata/Ouro/Diamante">
            <div className="grid gap-3 md:grid-cols-2">
              {plans.map((p) => (
                <article key={p.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">{p.name}</h4>
                      <p className="text-xs text-muted-foreground">
                        {p.priceMonthly ? `R$ ${p.priceMonthly.toFixed(2)}/mês` : `Taxa: ${p.feePercent}%`}
                        {p.searchBoost && ` · Boost de busca ×${p.searchBoost}`}
                      </p>
                    </div>
                    <Switch checked={p.active} onCheckedChange={() => {
                      setPlans((prev) => prev.map((x) => x.id === p.id ? { ...x, active: !x.active } : x));
                      toast("Plano alternado (mock)");
                    }} />
                  </div>
                  <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                    {p.benefits.map((b) => <li key={b}>• {b}</li>)}
                  </ul>
                </article>
              ))}
            </div>
          </AdminDashboardSection>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}

function BalanceCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-[11px] uppercase text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${tone}`}>{value}</div>
    </div>
  );
}

function ConfigField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface/40 p-3">
      <Label className="text-[11px] uppercase text-muted-foreground">{label}</Label>
      <div className="mt-1 text-sm font-semibold text-foreground">
        {typeof value === "string" || typeof value === "number" ? <Input readOnly value={value} className="mt-1" /> : value}
      </div>
    </div>
  );
}
