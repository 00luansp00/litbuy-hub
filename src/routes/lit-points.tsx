import { createFileRoute, Link } from "@tanstack/react-router";
import { Coins, Gift, ShoppingBag, Sparkles, ShieldCheck, Star, Store, Rocket, Percent } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { litPointsService } from "@/services/litPointsService";
import type {
  LitPointsBalance,
  LitPointsFaqItem,
  LitPointsRule,
  LitPointsTierBenefit,
  LitPointsTransaction,
  LitPointsUsageRule,
} from "@/types";

export const Route = createFileRoute("/lit-points")({
  head: () => ({
    meta: [
      { title: "LIT Points — Programa de recompensas da LIT Buy" },
      {
        name: "description",
        content:
          "Conheça o programa LIT Points: como ganhar, como usar e as regras do programa de recompensas próprio da LIT Buy.",
      },
      { property: "og:title", content: "LIT Points — LIT Buy" },
      {
        property: "og:description",
        content: "Programa próprio de recompensas da LIT Buy. Ganhe pontos comprando, vendendo e avaliando.",
      },
    ],
  }),
  component: LitPointsPage,
});

const iconMap: Record<string, typeof ShoppingBag> = {
  ShoppingBag,
  Store,
  Star,
  ShieldCheck,
  Sparkles,
  Percent,
  Gift,
  Rocket,
};

function Icon({ name, className }: { name: string; className?: string }) {
  const C = iconMap[name] ?? Sparkles;
  return <C className={className} />;
}

function LitPointsPage() {
  const [balance, setBalance] = useState<LitPointsBalance | null>(null);
  const [rules, setRules] = useState<LitPointsRule[]>([]);
  const [usage, setUsage] = useState<LitPointsUsageRule[]>([]);
  const [tiers, setTiers] = useState<LitPointsTierBenefit[]>([]);
  const [history, setHistory] = useState<LitPointsTransaction[]>([]);
  const [faq, setFaq] = useState<LitPointsFaqItem[]>([]);

  useEffect(() => {
    Promise.all([
      litPointsService.getLitPointsBalance(),
      litPointsService.getLitPointsRules(),
      litPointsService.getLitPointsUsageRules(),
      litPointsService.getLitPointsTierBenefits(),
      litPointsService.getLitPointsHistory(),
      litPointsService.getLitPointsFaq(),
    ]).then(([b, r, u, t, h, f]) => {
      setBalance(b);
      setRules(r);
      setUsage(u);
      setTiers(t);
      setHistory(h);
      setFaq(f);
    });
  }, []);

  return (
    <div className="container-lit space-y-10 py-8 md:py-12">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-accent/10 to-transparent p-8 md:p-12">
        <div className="max-w-2xl space-y-4">
          <Badge variant="secondary" className="gap-1">
            <Coins className="h-3 w-3" /> Programa próprio LIT Buy
          </Badge>
          <h1 className="text-3xl font-bold text-foreground md:text-4xl">
            LIT Points — Sua fidelidade recompensada
          </h1>
          <p className="text-muted-foreground">
            Ganhe pontos comprando, vendendo, avaliando e participando de campanhas.
            Use em descontos e benefícios dentro da LIT Buy.
          </p>
          <p className="text-xs text-muted-foreground">
            Este programa é demonstrativo no MVP. Pontos não são dinheiro e não podem ser sacados.
          </p>
        </div>
      </section>

      {/* Saldo */}
      {balance && (
        <section className="grid gap-4 rounded-2xl border border-border bg-card p-6 md:grid-cols-4">
          <Stat label="Total de pontos" value={balance.total} />
          <Stat label="Pendentes" value={balance.pending} />
          <Stat label="Ganhos no mês" value={balance.earnedThisMonth} />
          <Stat label="Expirando em breve" value={balance.expiringSoon} />
        </section>
      )}

      {/* Como ganhar */}
      <section>
        <h2 className="mb-4 text-xl font-bold text-foreground">Como ganhar LIT Points</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {rules.map((r) => (
            <div key={r.id} className="rounded-2xl border border-border bg-card p-5">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon name={r.icon} className="h-5 w-5" />
              </span>
              <h3 className="mt-3 font-semibold text-foreground">{r.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Como usar */}
      <section>
        <h2 className="mb-4 text-xl font-bold text-foreground">Como usar LIT Points</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {usage.map((u) => (
            <div key={u.id} className="rounded-2xl border border-border bg-card p-5">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent/10 text-accent">
                <Icon name={u.icon} className="h-5 w-5" />
              </span>
              <h3 className="mt-3 font-semibold text-foreground">{u.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{u.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Multiplicadores por nível */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-xl font-bold text-foreground">Multiplicadores por nível</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Vendedores com nível mais alto acumulam pontos mais rápido.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          {tiers.map((t) => (
            <div key={t.level} className="rounded-xl border border-border bg-surface/50 p-4 text-center">
              <div className="text-xs uppercase text-muted-foreground">{t.level}</div>
              <div className="mt-1 text-2xl font-bold text-primary">×{t.multiplier}</div>
              <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Exemplo */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-xl font-bold text-foreground">Exemplo demonstrativo</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Uma compra de R$ 100 pode gerar cerca de <strong className="text-foreground">100 pontos base</strong> mais bônus conforme seu nível.
        </p>
      </section>

      {/* Histórico */}
      {history.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-xl font-bold text-foreground">Histórico recente</h2>
          <ul className="mt-3 divide-y divide-border">
            {history.slice(0, 6).map((h) => (
              <li key={h.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <div className="font-medium text-foreground">{h.description}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(h.createdAt).toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <div className={h.amount >= 0 ? "text-success font-semibold" : "text-destructive font-semibold"}>
                  {h.amount >= 0 ? "+" : ""}
                  {h.amount} pts
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

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

      {/* CTA */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Comece a ganhar pontos hoje</h3>
          <p className="text-sm text-muted-foreground">Compre ou venda na LIT Buy e acumule LIT Points.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link to="/buscar">Comprar</Link></Button>
          <Button asChild><Link to="/vendedor">Vender</Link></Button>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold text-foreground">{value.toLocaleString("pt-BR")}</div>
    </div>
  );
}
