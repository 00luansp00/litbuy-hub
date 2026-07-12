import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import { InfoPageLayout, InfoSection, RulesList, LegalNotice } from "@/components/info/InfoPageLayout";
import { infoService } from "@/services/infoService";
import { analyticsService } from "@/services/analyticsService";
import type { LegalDraftNotice, PlatformRule } from "@/types";

export const Route = createFileRoute("/regras-da-plataforma")({
  head: () => ({
    meta: [
      { title: "Regras da Plataforma — LIT Buy" },
      { name: "description", content: "Regras de uso da LIT Buy: comunicação, anúncios, entrega, mediação, afiliados e penalidades." },
      { property: "og:title", content: "Regras da Plataforma — LIT Buy" },
      { property: "og:description", content: "Comportamento esperado no marketplace LIT Buy e o que não é permitido." },
    ],
  }),
  component: RegrasPage,
});

function RegrasPage() {
  const [rules, setRules] = useState<PlatformRule[]>([]);
  const [notice, setNotice] = useState<LegalDraftNotice | null>(null);

  useEffect(() => {
    analyticsService.track("policy_page_viewed_mocked", { page: "regras-da-plataforma" });
    void infoService.getPlatformRules().then(setRules);
    void infoService.getLegalNotice().then(setNotice);
  }, []);

  const groups = [
    { key: "all" as const, title: "Regras gerais" },
    { key: "buyer" as const, title: "Compradores" },
    { key: "seller" as const, title: "Vendedores" },
    { key: "affiliate" as const, title: "Afiliados" },
  ];

  return (
    <InfoPageLayout
      eyebrow="Comunidade"
      title="Regras da Plataforma"
      subtitle="Diretrizes que mantêm a LIT Buy segura e justa para todos."
      icon={<ScrollText className="h-6 w-6 text-primary-foreground" />}
    >
      {notice ? <LegalNotice notice={notice} /> : null}

      {groups.map((g) => {
        const list = rules.filter((r) => r.audience === g.key);
        if (list.length === 0) return null;
        return (
          <InfoSection key={g.key} title={g.title}>
            <RulesList rules={list} />
          </InfoSection>
        );
      })}

      <InfoSection title="Exemplos de comportamento proibido">
        <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
          <li>Tentativa de burlar taxas ou pagamentos da LIT Buy.</li>
          <li>Combinar entrega ou pagamento por fora.</li>
          <li>Uso de múltiplas contas para fraude ou manipulação de reputação.</li>
          <li>Envio de spam, phishing ou links maliciosos.</li>
          <li>Denúncias falsas ou coordenadas.</li>
          <li>Anúncio de itens proibidos (ver /itens-proibidos).</li>
        </ul>
      </InfoSection>

      <InfoSection title="Penalidades futuras">
        <p className="text-sm text-muted-foreground">
          Advertência, bloqueio de anúncio, suspensão temporária e banimento definitivo poderão ser aplicados
          conforme a gravidade. Ações reais dependem de backend, RBAC e audit log dedicados.
        </p>
      </InfoSection>
    </InfoPageLayout>
  );
}
