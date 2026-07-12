import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { InfoPageLayout, InfoSection, PolicyBlock, LegalNotice } from "@/components/info/InfoPageLayout";
import { infoService } from "@/services/infoService";
import { analyticsService } from "@/services/analyticsService";
import type { LegalDraftNotice, PolicySection } from "@/types";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — LIT Buy" },
      { name: "description", content: "Rascunho demonstrativo dos Termos de Uso da LIT Buy. Não substitui documento jurídico final." },
      { property: "og:title", content: "Termos de Uso — LIT Buy" },
      { property: "og:description", content: "Termos de uso preliminares do marketplace LIT Buy." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TermosPage,
});

function TermosPage() {
  const [sections, setSections] = useState<PolicySection[]>([]);
  const [notice, setNotice] = useState<LegalDraftNotice | null>(null);
  useEffect(() => {
    analyticsService.track("policy_page_viewed_mocked", { page: "termos" });
    void infoService.getTermsSections().then(setSections);
    void infoService.getLegalNotice().then(setNotice);
  }, []);
  return (
    <InfoPageLayout
      eyebrow="Legal"
      title="Termos de Uso"
      subtitle="Rascunho demonstrativo. Não constitui documento jurídico final."
      icon={<FileText className="h-6 w-6 text-primary-foreground" />}
    >
      {notice ? <LegalNotice notice={notice} /> : null}
      <InfoSection title="Termos">
        <PolicyBlock sections={sections} />
      </InfoSection>
    </InfoPageLayout>
  );
}
