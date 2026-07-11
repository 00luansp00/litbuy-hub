import type { AffiliateFaqItem } from "@/types";

export function AffiliateFaq({ faq }: { faq: AffiliateFaqItem[] }) {
  return (
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
  );
}
