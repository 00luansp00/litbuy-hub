import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShoppingBag, ShieldCheck, MessageCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { InfoPageLayout, InfoSection, StepByStep, InfoCard } from "@/components/info/InfoPageLayout";
import { infoService } from "@/services/infoService";
import type { StepItem } from "@/types";

export const Route = createFileRoute("/como-comprar")({
  head: () => ({
    meta: [
      { title: "Como comprar — LIT Buy" },
      { name: "description", content: "Aprenda como comprar com segurança na LIT Buy: pagamento protegido, chat do pedido, Proteção LIT e mediação." },
      { property: "og:title", content: "Como comprar na LIT Buy" },
      { property: "og:description", content: "Passo a passo do comprador: busca, pagamento, entrega e avaliação com proteção da LIT Buy." },
    ],
  }),
  component: ComoComprarPage,
});

function ComoComprarPage() {
  const [steps, setSteps] = useState<StepItem[]>([]);
  useEffect(() => { void infoService.getBuyingSteps().then(setSteps); }, []);
  return (
    <InfoPageLayout
      eyebrow="Comprador"
      title="Como comprar na LIT Buy"
      subtitle="Um passo a passo direto do comprador — do primeiro clique à avaliação final."
      icon={<ShoppingBag className="h-6 w-6 text-primary-foreground" />}
    >
      <Alert>
        <AlertTitle>Mantenha toda conversa dentro da LIT Buy</AlertTitle>
        <AlertDescription>
          Negociações e entregas fora da plataforma perdem proteção, mediação e histórico oficial.
        </AlertDescription>
      </Alert>

      <InfoSection title="Passo a passo">
        <StepByStep steps={steps} />
      </InfoSection>

      <InfoSection title="Boas práticas do comprador">
        <div className="grid gap-3 md:grid-cols-2">
          <InfoCard title="Compra segura" description="Use o checkout LIT Buy e ative a Proteção LIT quando disponível." icon={<ShieldCheck className="h-5 w-5" />} />
          <InfoCard title="Produto dinâmico" description="Anúncios com variação exigem escolha antes de comprar." icon={<ShoppingBag className="h-5 w-5" />} />
          <InfoCard title="Entrega manual e automática" description="Manual: vendedor entrega no chat do pedido. Automática: liberação imediata visual." icon={<MessageCircle className="h-5 w-5" />} />
          <InfoCard title="LIT Points" description="Ganhe pontos em compras. Regras em /lit-points." icon={<ShieldCheck className="h-5 w-5" />} to="/lit-points" />
        </div>
      </InfoSection>

      <InfoSection title="O que evitar">
        <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
          <li>Contato externo para negociar preço fora da LIT Buy.</li>
          <li>Compartilhar senhas ou dados fora do fluxo seguro do pedido.</li>
          <li>Confirmar recebimento antes de validar o produto.</li>
          <li>Ignorar problemas — abra 'Reportar problema' no pedido.</li>
        </ul>
      </InfoSection>

      <div className="flex flex-wrap gap-3">
        <Button asChild><Link to="/">Explorar marketplace</Link></Button>
        <Button variant="outline" asChild><Link to="/seguranca">Ver segurança</Link></Button>
        <Button variant="outline" asChild><Link to="/politica-de-reembolso">Política de reembolso</Link></Button>
      </div>
    </InfoPageLayout>
  );
}
