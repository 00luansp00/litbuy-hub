import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, AlertTriangle, Flag } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { InfoPageLayout, InfoSection, SafetyNotice, InfoCard } from "@/components/info/InfoPageLayout";
import { infoService } from "@/services/infoService";
import { analyticsService } from "@/services/analyticsService";
import type { SafetyRule } from "@/types";

export const Route = createFileRoute("/seguranca")({
  head: () => ({
    meta: [
      { title: "Segurança — LIT Buy" },
      { name: "description", content: "Como a LIT Buy protege compradores e vendedores: pagamento protegido, chat interno, Proteção LIT, mediação e denúncias." },
      { property: "og:title", content: "Segurança na LIT Buy" },
      { property: "og:description", content: "Boas práticas, proteção contra golpes e mediação da LIT Buy." },
    ],
  }),
  component: SegurancaPage,
});

function SegurancaPage() {
  const [rules, setRules] = useState<SafetyRule[]>([]);
  useEffect(() => {
    analyticsService.track("safety_page_viewed_mocked");
    void infoService.getSafetyRules().then(setRules);
  }, []);
  return (
    <InfoPageLayout
      eyebrow="Confiança"
      title="Segurança na LIT Buy"
      subtitle="Como funciona a proteção do marketplace e como você pode se proteger."
      icon={<ShieldCheck className="h-6 w-6 text-primary-foreground" />}
    >
      <Alert>
        <AlertTitle>Nunca negocie fora da LIT Buy</AlertTitle>
        <AlertDescription>
          Toda comunicação, entrega e pagamento devem ficar na plataforma. Fora dela, você perde proteção.
        </AlertDescription>
      </Alert>

      <InfoSection title="Regras de ouro">
        <SafetyNotice rules={rules} />
      </InfoSection>

      <InfoSection title="Camadas de proteção">
        <div className="grid gap-3 md:grid-cols-2">
          <InfoCard title="Pagamento protegido" description="O valor fica retido até a confirmação de recebimento (visual)." icon={<ShieldCheck className="h-5 w-5" />} />
          <InfoCard title="Chat dentro da plataforma" description="Evidência oficial em disputas e mediação." icon={<ShieldCheck className="h-5 w-5" />} />
          <InfoCard title="Proteção LIT" description="Camada opcional adicional para sua compra." icon={<ShieldCheck className="h-5 w-5" />} />
          <InfoCard title="Vendedor Verificado" description="Selo visual após KYC do vendedor." icon={<ShieldCheck className="h-5 w-5" />} />
        </div>
      </InfoSection>

      <InfoSection title="Segurança para contas digitais">
        <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
          <li>Nunca compartilhe senhas em WhatsApp, Discord ou canais externos.</li>
          <li>Use o cofre de entrega visual da LIT Buy.</li>
          <li>Ative recuperação e 2FA na conta assim que possível.</li>
          <li>Desconfie de "suporte" que peça login ou código por fora.</li>
        </ul>
      </InfoSection>

      <InfoSection title="Segurança para vendedores">
        <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
          <li>Complete a verificação (KYC visual) — em produção poderá ser obrigatória.</li>
          <li>Nunca envie o produto antes da confirmação do pagamento.</li>
          <li>Documente entregas dentro do chat do pedido.</li>
          <li>Se um comprador pedir contato externo, denuncie.</li>
        </ul>
      </InfoSection>

      <InfoSection title="Denúncias e mediação">
        <p className="text-sm text-muted-foreground">
          Denúncia sinaliza <strong>comportamento irregular</strong>. Mediação resolve <strong>problema em pedido específico</strong>.
          Use "Reportar problema" no pedido para acionar mediação e o botão de denúncia em anúncios/mensagens/perfis.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" asChild><Link to="/politica-de-reembolso"><AlertTriangle className="mr-2 h-4 w-4" /> Política de reembolso</Link></Button>
          <Button variant="outline" asChild><Link to="/itens-proibidos"><Flag className="mr-2 h-4 w-4" /> Itens proibidos</Link></Button>
          <Button variant="outline" asChild><Link to="/regras-da-plataforma">Regras da plataforma</Link></Button>
        </div>
      </InfoSection>
    </InfoPageLayout>
  );
}
