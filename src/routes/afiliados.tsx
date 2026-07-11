import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth/AuthGate";
import { AffiliateHero } from "@/components/affiliate/AffiliateHero";
import { AffiliateStatusCard } from "@/components/affiliate/AffiliateStatusCard";
import { AffiliateLinkCard } from "@/components/affiliate/AffiliateLinkCard";
import { AffiliateStatsGrid } from "@/components/affiliate/AffiliateStatsGrid";
import { AffiliateConversionTable } from "@/components/affiliate/AffiliateConversionTable";
import { AffiliateCommissionCard } from "@/components/affiliate/AffiliateCommissionCard";
import { AffiliateCampaigns } from "@/components/affiliate/AffiliateCampaigns";
import { AffiliateMaterials } from "@/components/affiliate/AffiliateMaterials";
import { AffiliateRules } from "@/components/affiliate/AffiliateRules";
import { AffiliateFaq } from "@/components/affiliate/AffiliateFaq";
import { AffiliateSecurityNotice } from "@/components/affiliate/AffiliateSecurityNotice";
import { AffiliatePayoutPreview } from "@/components/affiliate/AffiliatePayoutPreview";
import { affiliateService } from "@/services/affiliateService";
import { analyticsService } from "@/services/analyticsService";
import type {
  AffiliateCampaign,
  AffiliateCommissionSummary,
  AffiliateConversion,
  AffiliateFaqItem,
  AffiliateLink,
  AffiliateMaterial,
  AffiliatePayoutPreview as PayoutPreview,
  AffiliateProfile,
  AffiliateRule,
  AffiliateStats,
} from "@/types";

export const Route = createFileRoute("/afiliados")({
  head: () => ({
    meta: [
      { title: "Afiliados LIT Buy — Programa de indicações" },
      {
        name: "description",
        content:
          "Programa de afiliados da LIT Buy: indique compradores e vendedores, acompanhe conversões e comissões. Demonstração visual.",
      },
      { property: "og:title", content: "Afiliados LIT Buy" },
      {
        property: "og:description",
        content:
          "Indique, cresça e ganhe comissão demonstrativa no programa de afiliados da LIT Buy.",
      },
    ],
  }),
  component: AfiliadosPage,
});

function AfiliadosPage() {
  return (
    <AuthGate
      title="Entre para acessar o programa de afiliados"
      description="Você precisa estar logado na LIT Buy para acompanhar suas indicações, comissões e materiais."
    >
      <AfiliadosContent />
    </AuthGate>
  );
}

function AfiliadosContent() {
  const [profile, setProfile] = useState<AffiliateProfile | null>(null);
  const [link, setLink] = useState<AffiliateLink | null>(null);
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [conversions, setConversions] = useState<AffiliateConversion[]>([]);
  const [summary, setSummary] = useState<AffiliateCommissionSummary | null>(null);
  const [campaigns, setCampaigns] = useState<AffiliateCampaign[]>([]);
  const [materials, setMaterials] = useState<AffiliateMaterial[]>([]);
  const [rules, setRules] = useState<AffiliateRule[]>([]);
  const [faq, setFaq] = useState<AffiliateFaqItem[]>([]);
  const [payout, setPayout] = useState<PayoutPreview | null>(null);

  useEffect(() => {
    analyticsService.track("affiliate_page_viewed_mocked");
    Promise.all([
      affiliateService.getAffiliateProfile(),
      affiliateService.getAffiliateLink(),
      affiliateService.getAffiliateStats(),
      affiliateService.getAffiliateConversions(),
      affiliateService.getAffiliateCommissionSummary(),
      affiliateService.getAffiliateCampaigns(),
      affiliateService.getAffiliateMaterials(),
      affiliateService.getAffiliateRules(),
      affiliateService.getAffiliateFaq(),
      affiliateService.getAffiliatePayoutPreview(),
    ]).then(([p, l, st, cv, sm, cp, mt, ru, fa, po]) => {
      setProfile(p);
      setLink(l);
      setStats(st);
      setConversions(cv);
      setSummary(sm);
      setCampaigns(cp);
      setMaterials(mt);
      setRules(ru);
      setFaq(fa);
      setPayout(po);
    });
  }, []);

  return (
    <div className="container-lit space-y-10 py-8 md:py-12">
      <AffiliateHero />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {link && <AffiliateLinkCard link={link} />}
          {stats && <AffiliateStatsGrid stats={stats} />}
        </div>
        <aside className="space-y-4">
          {profile && <AffiliateStatusCard profile={profile} />}
          {payout && <AffiliatePayoutPreview preview={payout} />}
          <AffiliateSecurityNotice />
        </aside>
      </div>

      {summary && <AffiliateCommissionCard summary={summary} />}

      <section>
        <h2 className="mb-4 text-xl font-bold text-foreground">
          Histórico de conversões
        </h2>
        <AffiliateConversionTable conversions={conversions} />
      </section>

      <AffiliateCampaigns campaigns={campaigns} />
      <AffiliateMaterials materials={materials} />
      <AffiliateRules rules={rules} />
      <AffiliateFaq faq={faq} />

      <p className="text-center text-xs text-muted-foreground">
        Todos os dados desta página são demonstrativos. Nada é persistido.
      </p>
    </div>
  );
}
