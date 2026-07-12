import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Ban, Flag } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { InfoPageLayout, InfoSection, ProhibitedItemsGrid } from "@/components/info/InfoPageLayout";
import { infoService } from "@/services/infoService";
import { analyticsService } from "@/services/analyticsService";
import type { ProhibitedItem } from "@/types";

export const Route = createFileRoute("/itens-proibidos")({
  head: () => ({
    meta: [
      { title: "Itens Proibidos — LIT Buy" },
      { name: "description", content: "Lista de itens proibidos, restritos e sujeitos a revisão na LIT Buy." },
      { property: "og:title", content: "Itens Proibidos — LIT Buy" },
      { property: "og:description", content: "O que não pode ser anunciado ou vendido na LIT Buy." },
    ],
  }),
  component: ProibidosPage,
});

function ProibidosPage() {
  const [items, setItems] = useState<ProhibitedItem[]>([]);
  useEffect(() => {
    analyticsService.track("prohibited_items_viewed_mocked");
    void infoService.getProhibitedItems().then(setItems);
  }, []);
  return (
    <InfoPageLayout
      eyebrow="Regras"
      title="Itens proibidos e restritos"
      subtitle="O que não pode circular na LIT Buy e o que pode exigir revisão adicional."
      icon={<Ban className="h-6 w-6 text-primary-foreground" />}
    >
      <Alert>
        <AlertTitle>Encontrou um anúncio suspeito?</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-3 flex-wrap">
          <span>Denúncias ajudam a manter a comunidade segura.</span>
          <Button asChild size="sm" variant="outline">
            <Link to="/"><Flag className="mr-2 h-4 w-4" /> Ir para o marketplace</Link>
          </Button>
        </AlertDescription>
      </Alert>

      <InfoSection title="Categorias">
        <ProhibitedItemsGrid items={items} />
      </InfoSection>

      <InfoSection title="Observações">
        <p className="text-sm text-muted-foreground">
          Esta lista é demonstrativa e pode ser expandida. Em produção, a LIT Buy poderá exigir documentação
          adicional, remover anúncios e suspender contas que violem estas regras.
        </p>
      </InfoSection>
    </InfoPageLayout>
  );
}
