import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { InfoPageLayout, InfoSection, PolicyBlock, LegalNotice } from "@/components/info/InfoPageLayout";
import { infoService } from "@/services/infoService";
import { analyticsService } from "@/services/analyticsService";
import type { LegalDraftNotice, PolicySection } from "@/types";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Privacidade — LIT Buy" },
      { name: "description", content: "Rascunho demonstrativo de Privacidade da LIT Buy. Política final exigirá revisão jurídica e LGPD." },
      { property: "og:title", content: "Privacidade — LIT Buy" },
      { property: "og:description", content: "Como a LIT Buy pretende tratar dados de usuários em produção (rascunho)." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
  const [sections, setSections] = useState<PolicySection[]>([]);
  const [notice, setNotice] = useState<LegalDraftNotice | null>(null);
  useEffect(() => {
    analyticsService.track("policy_page_viewed_mocked", { page: "privacidade" });
    void infoService.getPrivacySections().then(setSections);
    void infoService.getLegalNotice().then(setNotice);
  }, []);
  return (
    <InfoPageLayout
      eyebrow="Legal"
      title="Privacidade"
      subtitle="Rascunho demonstrativo. Política final exigirá revisão jurídica, LGPD e arquitetura real de dados."
      icon={<Lock className="h-6 w-6 text-primary-foreground" />}
    >
      {notice ? <LegalNotice notice={notice} /> : null}
      <InfoSection title="Política de Privacidade">
        <PolicyBlock sections={sections} />
      </InfoSection>
    </InfoPageLayout>
  );
}
