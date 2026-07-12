import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InfoPageLayout, InfoSection, RefundPolicyList, LegalNotice } from "@/components/info/InfoPageLayout";
import { infoService } from "@/services/infoService";
import { analyticsService } from "@/services/analyticsService";
import type { LegalDraftNotice, RefundPolicyRule } from "@/types";

export const Route = createFileRoute("/politica-de-reembolso")({
  head: () => ({
    meta: [
      { title: "Política de Reembolso — LIT Buy" },
      { name: "description", content: "Como funcionam reembolsos, mediação e Proteção LIT no marketplace LIT Buy (modo demonstrativo)." },
      { property: "og:title", content: "Política de Reembolso — LIT Buy" },
      { property: "og:description", content: "Quando o comprador pode abrir problema, quando o vendedor tem saldo bloqueado e quando reembolso é possível." },
    ],
  }),
  component: ReembolsoPage,
});

function ReembolsoPage() {
  const [rules, setRules] = useState<RefundPolicyRule[]>([]);
  const [notice, setNotice] = useState<LegalDraftNotice | null>(null);
  useEffect(() => {
    analyticsService.track("policy_page_viewed_mocked", { page: "politica-de-reembolso" });
    void infoService.getRefundPolicy().then(setRules);
    void infoService.getLegalNotice().then(setNotice);
  }, []);
  return (
    <InfoPageLayout
      eyebrow="Confiança"
      title="Política de Reembolso"
      subtitle="Quando reembolso é possível, quando a mediação atua e como a Proteção LIT participa."
      icon={<RefreshCcw className="h-6 w-6 text-primary-foreground" />}
    >
      {notice ? <LegalNotice notice={notice} /> : null}

      <InfoSection title="Problema, denúncia e mediação">
        <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
          <li><strong>Problema</strong>: aberto pelo comprador dentro do pedido — inicia a mediação.</li>
          <li><strong>Mediação</strong>: análise do caso pela LIT Buy com base nas evidências do chat do pedido.</li>
          <li><strong>Denúncia</strong>: sinaliza comportamento geral irregular do usuário/anúncio, independente de um pedido.</li>
        </ul>
      </InfoSection>

      <InfoSection title="Casos elegíveis e não elegíveis">
        <RefundPolicyList rules={rules} />
      </InfoSection>

      <InfoSection title="Quando o saldo do vendedor pode ficar bloqueado">
        <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
          <li>Enquanto o comprador não confirma o recebimento.</li>
          <li>Durante análise de mediação ou denúncia.</li>
          <li>Em caso de suspeita de fraude ou chargeback.</li>
        </ul>
      </InfoSection>

      <InfoSection title="Prazos e evidências">
        <p className="text-sm text-muted-foreground">
          Prazos exatos, coleta de evidências e critérios de decisão dependerão do backend real de mediação,
          análise antifraude e regras contratuais definidas em produção.
        </p>
      </InfoSection>

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" asChild><Link to="/seguranca">Ver segurança</Link></Button>
        <Button variant="outline" asChild><Link to="/regras-da-plataforma">Regras da plataforma</Link></Button>
      </div>
    </InfoPageLayout>
  );
}
