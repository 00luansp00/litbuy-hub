import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HelpCircle, Search, ShoppingBag, Store, ShieldCheck, RefreshCcw, Ban, Mail, Sparkles, Share2, KeyRound, CreditCard, Send, Gavel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InfoPageLayout, InfoSection, InfoCard, FAQAccordion } from "@/components/info/InfoPageLayout";
import { infoService } from "@/services/infoService";
import { analyticsService } from "@/services/analyticsService";
import type { FaqItem, HelpCategory } from "@/types";

export const Route = createFileRoute("/ajuda")({
  head: () => ({
    meta: [
      { title: "Central de Ajuda — LIT Buy" },
      { name: "description", content: "Central de ajuda LIT Buy: FAQs, categorias de suporte e links úteis para compradores e vendedores." },
      { property: "og:title", content: "Central de Ajuda — LIT Buy" },
      { property: "og:description", content: "Encontre respostas rápidas para dúvidas de compra, venda, pagamento e segurança na LIT Buy." },
    ],
  }),
  component: AjudaPage,
});

const ICONS: Record<string, typeof HelpCircle> = {
  ShoppingBag, Store, CreditCard, Send, KeyRound, Gavel, Sparkles, Share2, ShieldCheck,
};

function AjudaPage() {
  const [categories, setCategories] = useState<HelpCategory[]>([]);
  const [faq, setFaq] = useState<FaqItem[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    analyticsService.track("help_page_viewed_mocked");
    void infoService.getHelpCategories().then(setCategories);
    void infoService.getHelpFaq().then(setFaq);
  }, []);

  const filtered = q
    ? faq.filter((f) => (f.question + f.answer).toLowerCase().includes(q.toLowerCase()))
    : faq;

  return (
    <InfoPageLayout
      eyebrow="Suporte"
      title="Como podemos ajudar?"
      subtitle="Encontre respostas rápidas ou navegue pelas categorias de suporte da LIT Buy."
      icon={<HelpCircle className="h-6 w-6 text-primary-foreground" />}
    >
      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar na ajuda (visual)"
          className="pl-9"
          aria-label="Buscar na ajuda"
        />
      </div>

      <Alert>
        <AlertTitle>Suporte em modo demonstrativo</AlertTitle>
        <AlertDescription>
          O suporte real ainda não está implementado no MVP. Use os canais visuais em /contato para simular.
        </AlertDescription>
      </Alert>

      <InfoSection title="Categorias de ajuda">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => {
            const Icon = ICONS[c.icon] ?? HelpCircle;
            return (
              <InfoCard
                key={c.id}
                title={c.title}
                description={c.description}
                to={c.to}
                icon={<Icon className="h-5 w-5" />}
              />
            );
          })}
        </div>
      </InfoSection>

      <InfoSection title="Perguntas frequentes">
        <Card className="p-4 bg-surface/40">
          <FAQAccordion items={filtered} />
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">Nenhuma resposta encontrada.</p>
          ) : null}
        </Card>
      </InfoSection>

      <InfoSection title="Atalhos úteis">
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" asChild><Link to="/como-comprar"><ShoppingBag className="mr-2 h-4 w-4" /> Como comprar</Link></Button>
          <Button variant="outline" asChild><Link to="/como-vender"><Store className="mr-2 h-4 w-4" /> Como vender</Link></Button>
          <Button variant="outline" asChild><Link to="/seguranca"><ShieldCheck className="mr-2 h-4 w-4" /> Segurança</Link></Button>
          <Button variant="outline" asChild><Link to="/politica-de-reembolso"><RefreshCcw className="mr-2 h-4 w-4" /> Reembolso</Link></Button>
          <Button variant="outline" asChild><Link to="/itens-proibidos"><Ban className="mr-2 h-4 w-4" /> Itens proibidos</Link></Button>
          <Button variant="outline" asChild><Link to="/contato"><Mail className="mr-2 h-4 w-4" /> Contato</Link></Button>
        </div>
      </InfoSection>
    </InfoPageLayout>
  );
}
