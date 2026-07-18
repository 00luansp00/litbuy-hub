import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/providers/AuthContext";
import { Store, Award, ShieldCheck, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  InfoPageLayout,
  InfoSection,
  StepByStep,
  InfoCard,
} from "@/components/info/InfoPageLayout";
import { infoService } from "@/services/infoService";
import type { StepItem } from "@/types";

export const Route = createFileRoute("/como-vender")({
  head: () => ({
    meta: [
      { title: "Como vender — LIT Buy" },
      {
        name: "description",
        content:
          "Aprenda como vender na LIT Buy: crie anúncios, escolha destaque, use LIT-MAX e construa reputação com Vendedor Verificado.",
      },
      { property: "og:title", content: "Como vender na LIT Buy" },
      {
        property: "og:description",
        content:
          "Fluxo completo do vendedor: anúncio, entrega, mediação, saldo e níveis de reputação.",
      },
    ],
  }),
  component: ComoVenderPage,
});

function ComoVenderPage() {
  const { isAuthenticated, hasSellerAccess } = useAuth();
  const [steps, setSteps] = useState<StepItem[]>([]);
  const cta = hasSellerAccess ? "/vendedor" : isAuthenticated ? "/perfil/vendedor" : "/login";
  useEffect(() => {
    void infoService.getSellingSteps().then(setSteps);
  }, []);
  return (
    <InfoPageLayout
      eyebrow="Vendedor"
      title="Como vender na LIT Buy"
      subtitle="Do primeiro anúncio à construção de uma reputação sólida no marketplace."
      icon={<Store className="h-6 w-6 text-primary-foreground" />}
    >
      <Alert>
        <AlertTitle>Toda conta pode solicitar acesso de vendedor</AlertTitle>
        <AlertDescription>
          A solicitação passa por análise administrativa. Aprovação interna não significa KYC
          verificado; documentos poderão ser exigidos futuramente e o acesso só é concedido após
          aprovação.
        </AlertDescription>
      </Alert>

      <InfoSection title="Passo a passo">
        <StepByStep steps={steps} />
      </InfoSection>

      <InfoSection title="Recursos do vendedor">
        <div className="grid gap-3 md:grid-cols-2">
          <InfoCard
            title="Níveis de vendedor"
            description="Bronze, Prata, Ouro, Diamante e Elite — construídos por reputação."
            icon={<Award className="h-5 w-5" />}
          />
          <InfoCard
            title="Vendedor Verificado"
            description="Selo visual após KYC. Aumenta confiança do comprador."
            icon={<ShieldCheck className="h-5 w-5" />}
          />
          <InfoCard
            title="Equipe do vendedor"
            description="Convide membros com cargos e permissões (visual)."
            icon={<Users className="h-5 w-5" />}
          />
          <InfoCard
            title="LIT-MAX"
            description="Plano premium próprio da LIT Buy com destaques e benefícios."
            icon={<Award className="h-5 w-5" />}
            to="/taxas"
          />
        </div>
      </InfoSection>

      <InfoSection title="Boas práticas">
        <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
          <li>Entregue dentro do prazo prometido.</li>
          <li>Comunique-se apenas no chat do pedido.</li>
          <li>Use fotos e descrições fiéis ao produto.</li>
          <li>Responda perguntas públicas com clareza.</li>
        </ul>
      </InfoSection>

      <InfoSection title="Proibido para vendedores">
        <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
          <li>
            Vender itens da lista de{" "}
            <Link to="/itens-proibidos" className="text-primary hover:underline">
              itens proibidos
            </Link>
            .
          </li>
          <li>Tirar negociação para fora da LIT Buy.</li>
          <li>Manipular reputação com múltiplas contas.</li>
          <li>Compartilhar dados sensíveis fora do cofre seguro visual.</li>
        </ul>
      </InfoSection>

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link to={cta}>Começar como vendedor</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/taxas">Ver taxas e planos</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/regras-da-plataforma">Regras da plataforma</Link>
        </Button>
      </div>
    </InfoPageLayout>
  );
}
