import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import type {
  ContactOption,
  FaqItem,
  InfoPageLink,
  LegalDraftNotice,
  PlatformRule,
  ProhibitedItem,
  RefundPolicyRule,
  SafetyRule,
  StepItem,
} from "@/types";

export function InfoPageLayout({
  eyebrow,
  title,
  subtitle,
  icon,
  children,
  aside,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="container-lit py-12 md:py-16">
      <div className="mb-8 flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
        <span>/</span>
        <span className="text-foreground">{title}</span>
      </div>

      <div className="mb-10 max-w-3xl">
        {eyebrow ? (
          <span className="inline-block text-xs font-medium uppercase tracking-widest text-primary mb-3">
            {eyebrow}
          </span>
        ) : null}
        <div className="flex items-start gap-4">
          {icon ? (
            <div
              className="hidden sm:grid h-12 w-12 shrink-0 place-items-center rounded-xl shadow-elegant"
              style={{ backgroundImage: "var(--gradient-primary)" }}
            >
              {icon}
            </div>
          ) : null}
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{title}</h1>
            {subtitle ? <p className="mt-3 text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
      </div>

      <div className={aside ? "grid gap-10 lg:grid-cols-[1fr_280px]" : ""}>
        <div className="space-y-10">{children}</div>
        {aside ? <aside className="space-y-4">{aside}</aside> : null}
      </div>

      <Separator className="my-12" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" asChild>
          <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao marketplace</Link>
        </Button>
        <span className="text-xs text-muted-foreground">LIT Buy — conteúdo demonstrativo</span>
      </div>
    </div>
  );
}

export function InfoSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl md:text-2xl font-semibold">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function InfoNavigation({ links }: { links: InfoPageLink[] }) {
  return (
    <Card className="p-5 space-y-3 bg-surface/40">
      <h3 className="text-sm font-semibold">Também pode interessar</h3>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.to + l.label}>
            <Link
              to={l.to}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors block"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function InfoCard({
  title,
  description,
  icon,
  to,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
  to?: string;
}) {
  const content = (
    <Card className="p-5 h-full hover:border-primary/50 transition-colors bg-surface/40">
      <div className="flex items-start gap-3">
        {icon ? (
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
            {icon}
          </div>
        ) : null}
        <div>
          <h3 className="font-semibold mb-1">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </Card>
  );
  if (to) return <Link to={to}>{content}</Link>;
  return content;
}

export function StepByStep({ steps }: { steps: StepItem[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((s) => (
        <li key={s.order} className="flex gap-4 rounded-lg border border-border bg-surface/30 p-4">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 text-primary text-sm font-semibold shrink-0">
            {s.order}
          </div>
          <div>
            <p className="font-medium">{s.title}</p>
            <p className="text-sm text-muted-foreground mt-1">{s.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function FAQAccordion({ items }: { items: FaqItem[] }) {
  return (
    <Accordion type="single" collapsible className="w-full">
      {items.map((f) => (
        <AccordionItem key={f.id} value={f.id}>
          <AccordionTrigger className="text-left">{f.question}</AccordionTrigger>
          <AccordionContent className="text-muted-foreground">{f.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

export function LegalNotice({ notice }: { notice: LegalDraftNotice }) {
  return (
    <Alert>
      <AlertTitle>{notice.title}</AlertTitle>
      <AlertDescription>{notice.description}</AlertDescription>
    </Alert>
  );
}

export function SafetyNotice({ rules }: { rules: SafetyRule[] }) {
  const toneStyle: Record<SafetyRule["tone"], string> = {
    info: "border-border",
    warning: "border-yellow-500/40",
    danger: "border-destructive/50",
    success: "border-green-500/40",
  };
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rules.map((r) => (
        <Card key={r.id} className={`p-4 bg-surface/40 ${toneStyle[r.tone]}`}>
          <p className="font-medium">{r.title}</p>
          <p className="text-sm text-muted-foreground mt-1">{r.description}</p>
        </Card>
      ))}
    </div>
  );
}

export function RulesList({ rules }: { rules: PlatformRule[] }) {
  const audienceLabel: Record<PlatformRule["audience"], string> = {
    all: "Todos",
    buyer: "Comprador",
    seller: "Vendedor",
    affiliate: "Afiliado",
  };
  return (
    <ul className="space-y-3">
      {rules.map((r) => (
        <li key={r.id} className="rounded-lg border border-border bg-surface/30 p-4">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <p className="font-medium">{r.title}</p>
            <Badge variant="outline" className="text-[10px]">{audienceLabel[r.audience]}</Badge>
            {r.severity === "critical" ? (
              <Badge variant="destructive" className="text-[10px]">Crítico</Badge>
            ) : r.severity === "warning" ? (
              <Badge variant="secondary" className="text-[10px]">Atenção</Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">{r.description}</p>
        </li>
      ))}
    </ul>
  );
}

export function ProhibitedItemsGrid({ items }: { items: ProhibitedItem[] }) {
  const groups: Array<{ key: ProhibitedItem["category"]; title: string }> = [
    { key: "prohibited", title: "Proibidos" },
    { key: "restricted", title: "Restritos" },
    { key: "review", title: "Sujeitos a revisão" },
  ];
  return (
    <div className="space-y-8">
      {groups.map((g) => {
        const list = items.filter((i) => i.category === g.key);
        if (list.length === 0) return null;
        return (
          <div key={g.key}>
            <h3 className="text-lg font-semibold mb-3">{g.title}</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {list.map((it) => (
                <Card key={it.id} className="p-4 bg-surface/40">
                  <p className="font-medium">{it.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">{it.description}</p>
                  {it.examples?.length ? (
                    <p className="text-xs text-muted-foreground mt-2">
                      Exemplos: {it.examples.join(", ")}
                    </p>
                  ) : null}
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function PolicyBlock({ sections }: { sections: { id: string; title: string; body: string }[] }) {
  return (
    <div className="space-y-5">
      {sections.map((s) => (
        <div key={s.id}>
          <h3 className="font-semibold">{s.title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{s.body}</p>
        </div>
      ))}
    </div>
  );
}

export function ContactCard({ option }: { option: ContactOption }) {
  return (
    <Card className="p-5 bg-surface/40">
      <p className="font-semibold">{option.title}</p>
      <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
      <p className="mt-3 text-xs text-primary">{option.channel}</p>
    </Card>
  );
}

export function RefundPolicyList({ rules }: { rules: RefundPolicyRule[] }) {
  return (
    <ul className="space-y-3">
      {rules.map((r) => (
        <li key={r.id} className="rounded-lg border border-border bg-surface/30 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={r.eligible ? "default" : "destructive"} className="text-[10px]">
              {r.eligible ? "Elegível" : "Pode ser negado"}
            </Badge>
            <p className="font-medium">{r.title}</p>
          </div>
          <p className="text-sm text-muted-foreground">{r.description}</p>
        </li>
      ))}
    </ul>
  );
}
