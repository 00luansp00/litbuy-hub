import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Award,
  Check,
  Clock,
  Crown,
  Gem,
  Headphones,
  Info,
  Medal,
  Percent,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { platformEconomicsService } from "@/services/platformEconomicsService";
import { sellerLevelService } from "@/services/sellerLevelService";
import type {
  LitMaxBenefit,
  PaymentMethodFee,
  PayoutReleaseRule,
  PromotionTierPricing,
  SellerLevel,
} from "@/types";

export const Route = createFileRoute("/taxas")({
  head: () => ({
    meta: [
      { title: "Tarifas e prazos — LIT Buy" },
      {
        name: "description",
        content:
          "Conheça as tarifas, prazos, planos de destaque, LIT-MAX, Proteção LIT e níveis de vendedor no marketplace LIT Buy.",
      },
      { property: "og:title", content: "Tarifas e prazos — LIT Buy" },
      {
        property: "og:description",
        content: "Tarifas demonstrativas, prazos de liberação e planos de destaque da LIT Buy.",
      },
    ],
  }),
  component: TaxasPage,
});

const levelIcon: Record<string, typeof Medal> = {
  Medal, Award, Crown, Gem, Trophy,
};
const benefitIcon: Record<string, typeof Check> = {
  Check, Percent, Clock, Sparkles, Headphones, ShieldCheck,
};

function TaxasPage() {
  const [tiers, setTiers] = useState<PromotionTierPricing[]>([]);
  const [litmax, setLitmax] = useState<LitMaxBenefit[]>([]);
  const [methods, setMethods] = useState<PaymentMethodFee[]>([]);
  const [payoutRules, setPayoutRules] = useState<PayoutReleaseRule[]>([]);
  const [levels, setLevels] = useState<SellerLevel[]>([]);
  const [faq, setFaq] = useState<{ q: string; a: string }[]>([]);

  useEffect(() => {
    Promise.all([
      platformEconomicsService.getPromotionTiers(),
      platformEconomicsService.getLitMaxBenefits(),
      platformEconomicsService.getPaymentMethodFees(),
      platformEconomicsService.getPayoutRules(),
      sellerLevelService.getSellerLevels(),
      platformEconomicsService.getTaxasFaq(),
    ]).then(([t, l, m, p, sl, f]) => {
      setTiers(t); setLitmax(l); setMethods(m); setPayoutRules(p); setLevels(sl); setFaq(f);
    });
  }, []);

  const disclaimer = platformEconomicsService.getDisclaimer();

  return (
    <div className="container-lit space-y-10 py-8 md:py-12">
      <header className="space-y-3">
        <Badge variant="secondary">Institucional</Badge>
        <h1 className="text-3xl font-bold text-foreground md:text-4xl">Tarifas e prazos</h1>
        <p className="max-w-3xl text-muted-foreground">
          Transparência sobre taxas da plataforma, planos de destaque, prazos de liberação de saldo,
          Proteção LIT e níveis de vendedor. Tudo demonstrativo neste MVP.
        </p>
        <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs text-warning-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>{disclaimer}</span>
        </div>
      </header>

      {/* Planos de destaque */}
      <section>
        <h2 className="mb-1 text-xl font-bold text-foreground">Planos de destaque do anúncio</h2>
        <p className="mb-4 text-sm text-muted-foreground">Escolha o nível de exposição ao publicar seu anúncio.</p>
        <div className="grid gap-4 md:grid-cols-3">
          {tiers.map((t) => (
            <div key={t.tier} className="rounded-2xl border border-border bg-card p-6">
              <div className="text-xs uppercase text-muted-foreground">Plano</div>
              <h3 className="mt-1 text-lg font-bold text-foreground">{t.tier}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t.description}</p>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-start gap-2"><Sparkles className="mt-0.5 h-4 w-4 text-primary" /><span>{t.visibility}</span></div>
                <div className="flex items-start gap-2"><Percent className="mt-0.5 h-4 w-4 text-primary" /><span>{t.feeHint}</span></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* LIT-MAX */}
      <section className="rounded-2xl border border-border bg-gradient-to-br from-accent/10 to-primary/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Badge className="mb-2">Premium</Badge>
            <h2 className="text-xl font-bold text-foreground">LIT-MAX</h2>
            <p className="text-sm text-muted-foreground">Plano premium do vendedor com automações e benefícios.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {litmax.map((b) => (
            <div key={b.title} className="rounded-xl border border-border bg-card/70 p-4">
              <div className="text-sm font-semibold text-foreground">{b.title}</div>
              <p className="mt-1 text-xs text-muted-foreground">{b.description}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          LIT-MAX é demonstrativo nesta fase. Assinatura e cobrança reais exigem backend e pagamento seguro.
        </p>
      </section>

      {/* Níveis de vendedor */}
      <section>
        <h2 className="mb-1 text-xl font-bold text-foreground">Níveis de vendedor</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Reputação define taxa demonstrativa e prazo de liberação de saldo.
        </p>
        <div className="grid gap-4 md:grid-cols-5">
          {levels.map((l) => {
            const LIcon = levelIcon[l.icon] ?? Medal;
            return (
              <div key={l.name} className="rounded-2xl border border-border bg-card p-4">
                <div className={`flex items-center gap-2 ${l.color}`}>
                  <LIcon className="h-5 w-5" />
                  <span className="font-bold">{l.name}</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{l.tagline}</p>
                <div className="mt-3 space-y-1 text-xs">
                  <div><span className="text-muted-foreground">Taxa demo:</span> <strong>{l.fee.platformFeePercent}%</strong></div>
                  <div><span className="text-muted-foreground">Liberação:</span> <strong>{l.payout.releaseHours}h</strong></div>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {l.benefits.map((b) => {
                    const BIcon = benefitIcon[b.icon] ?? Check;
                    return (
                      <li key={b.title} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <BIcon className="mt-0.5 h-3.5 w-3.5 text-primary" />
                        <span>{b.title}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Valores e prazos finais serão definidos na operação real.</p>
      </section>

      {/* Prazos e regras de saldo */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-xl font-bold text-foreground">Regras de liberação de saldo</h2>
        <ul className="mt-3 divide-y divide-border">
          {payoutRules.map((r) => (
            <li key={r.situation} className="grid gap-1 py-3 md:grid-cols-[220px_1fr]">
              <div className="text-sm font-semibold text-foreground">{r.situation}</div>
              <div className="text-sm text-muted-foreground">{r.behavior}</div>
            </li>
          ))}
        </ul>
      </section>

      {/* Métodos de pagamento */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-xl font-bold text-foreground">Métodos de pagamento</h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface/70 text-left text-xs uppercase text-muted-foreground">
              <tr><th className="px-4 py-2">Método</th><th className="px-4 py-2">Taxa demo</th><th className="px-4 py-2">Observação</th></tr>
            </thead>
            <tbody>
              {methods.map((m) => (
                <tr key={m.method} className="border-t border-border">
                  <td className="px-4 py-2 font-medium text-foreground">{m.method}</td>
                  <td className="px-4 py-2 text-muted-foreground">{m.fee}</td>
                  <td className="px-4 py-2 text-muted-foreground">{m.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Proteção LIT */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
          <ShieldCheck className="h-5 w-5 text-success" /> Proteção LIT
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Cobertura opcional do pedido para mediação prioritária em caso de problema. Pode ser adicionada no checkout.
          A Proteção LIT influencia mediação, mas não libera saldo automaticamente do vendedor.
        </p>
      </section>

      {/* FAQ */}
      <section>
        <h2 className="mb-4 text-xl font-bold text-foreground">Perguntas frequentes</h2>
        <div className="space-y-3">
          {faq.map((f) => (
            <details key={f.q} className="group rounded-xl border border-border bg-card p-4">
              <summary className="cursor-pointer font-medium text-foreground">{f.q}</summary>
              <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Quer entender o programa de pontos?{" "}
        <Link to="/lit-points" className="font-medium text-primary hover:underline">
          Conheça o LIT Points
        </Link>
        .
      </section>
    </div>
  );
}
