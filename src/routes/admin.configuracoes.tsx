import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminDashboardSection } from "@/components/admin/AdminDashboardSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminAdvancedService } from "@/services/adminAdvancedService";
import type { AdminFeatureFlag } from "@/types";

export const Route = createFileRoute("/admin/configuracoes")({
  component: AdminSettingsPage,
});


function AdminSettingsPage() {

  const [platformFee, setPlatformFee] = useState("10");
  const [minWithdraw, setMinWithdraw] = useState("50");
  const [moderationAuto, setModerationAuto] = useState(true);
  const [twoFA, setTwoFA] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(false);
  const [darkAdmin, setDarkAdmin] = useState(true);
  const [flags, setFlags] = useState<AdminFeatureFlag[]>([]);

  useEffect(() => {
    adminAdvancedService.getFeatureFlags().then(setFlags);
  }, []);

  const toggleFlag = (key: string) => {
    setFlags((prev) => prev.map((f) => (f.key === key ? { ...f, enabled: !f.enabled } : f)));
    toast("Flag alternada (mock)");
  };

  const save = (label: string) =>
    toast(`${label} salvo`, {
      description:
        "Configuração administrativa mockada — nenhuma alteração real foi feita.",
    });


  return (
    <AdminLayout
      title="Configurações"
      description="Configurações visuais do painel — nenhuma persistência real."
      actions={
        <Badge variant="outline" className="gap-1 border-warning/40 text-[10px] text-warning">
          Mock
        </Badge>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <AdminDashboardSection
          title="Taxas da plataforma"
          description="Percentual cobrado por venda concluída."
          actions={
            <Button size="sm" onClick={() => save("Taxas")}>
              <Save className="mr-2 h-4 w-4" /> Salvar
            </Button>
          }
        >
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label htmlFor="fee">Taxa padrão (%)</Label>
              <Input
                id="fee"
                value={platformFee}
                onChange={(e) => setPlatformFee(e.target.value)}
              />
            </div>
          </div>
        </AdminDashboardSection>

        <AdminDashboardSection
          title="Regras de saque"
          description="Definições visuais para saques de vendedores."
          actions={
            <Button size="sm" onClick={() => save("Regras de saque")}>
              <Save className="mr-2 h-4 w-4" /> Salvar
            </Button>
          }
        >
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label htmlFor="minw">Valor mínimo (R$)</Label>
              <Input
                id="minw"
                value={minWithdraw}
                onChange={(e) => setMinWithdraw(e.target.value)}
              />
            </div>
          </div>
        </AdminDashboardSection>

        <AdminDashboardSection
          title="Moderação"
          description="Automação e revisões manuais."
          actions={
            <Button size="sm" onClick={() => save("Moderação")}>
              <Save className="mr-2 h-4 w-4" /> Salvar
            </Button>
          }
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Moderação automática</p>
              <p className="text-xs text-muted-foreground">
                Aplicar filtros automáticos em novos anúncios.
              </p>
            </div>
            <Switch checked={moderationAuto} onCheckedChange={setModerationAuto} />
          </div>
        </AdminDashboardSection>

        <AdminDashboardSection
          title="Segurança"
          description="Proteções visuais do painel administrativo."
          actions={
            <Button size="sm" onClick={() => save("Segurança")}>
              <Save className="mr-2 h-4 w-4" /> Salvar
            </Button>
          }
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Exigir 2FA para admins</p>
              <p className="text-xs text-muted-foreground">
                Requer autenticação em duas etapas.
              </p>
            </div>
            <Switch checked={twoFA} onCheckedChange={setTwoFA} />
          </div>
        </AdminDashboardSection>

        <AdminDashboardSection
          title="Notificações"
          description="Comunicações operacionais."
          actions={
            <Button size="sm" onClick={() => save("Notificações")}>
              <Save className="mr-2 h-4 w-4" /> Salvar
            </Button>
          }
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Alertas por e-mail</p>
              <p className="text-xs text-muted-foreground">
                Receber alertas críticos por e-mail.
              </p>
            </div>
            <Switch checked={emailAlerts} onCheckedChange={setEmailAlerts} />
          </div>
        </AdminDashboardSection>

        <AdminDashboardSection
          title="Aparência administrativa"
          description="Ajustes visuais do painel."
          actions={
            <Button size="sm" onClick={() => save("Aparência")}>
              <Save className="mr-2 h-4 w-4" /> Salvar
            </Button>
          }
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Tema escuro premium</p>
              <p className="text-xs text-muted-foreground">
                Alinhado à identidade da LIT Buy.
              </p>
            </div>
            <Switch checked={darkAdmin} onCheckedChange={setDarkAdmin} />
          </div>
        </AdminDashboardSection>
      </div>

      <Separator />

      <AdminDashboardSection
        title="Integrações futuras"
        description="Estas integrações serão habilitadas quando o backend estiver disponível."
      >
        <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          <li>· Antifraude e KYC</li>
          <li>· Gateway de pagamentos</li>
          <li>· Envio transacional de e-mail</li>
          <li>· Notificações push</li>
          <li>· Análise de comportamento</li>
          <li>· Exportação para BI</li>
        </ul>
      </AdminDashboardSection>
    </AdminLayout>
  );
}
