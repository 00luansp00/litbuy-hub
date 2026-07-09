import { SlidersHorizontal } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FilterSidebarProps {
  className?: string;
  /** Exibe o cabeçalho "Filtros" com botão limpar. */
  showHeader?: boolean;
}

const platforms = ["Steam", "Riot", "Epic Games", "Xbox", "PlayStation", "Nintendo"];
const regions = ["Brasil", "América Latina", "Europa", "América do Norte", "Global"];
const types = ["Conta", "Gift Card", "Moedas", "Skin", "Serviço", "Assinatura"];

/**
 * FilterSidebar — sidebar de filtros 100% visual.
 * Nenhuma lógica de negócio; apenas layout preparado para futura integração.
 */
export function FilterSidebar({ className, showHeader = true }: FilterSidebarProps) {
  return (
    <aside
      className={cn(
        "flex h-full flex-col gap-4 rounded-2xl border border-border bg-card p-4",
        className,
      )}
    >
      {showHeader && (
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
            <SlidersHorizontal className="h-4 w-4" /> Filtros
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
            Limpar
          </Button>
        </div>
      )}

      <Accordion
        type="multiple"
        defaultValue={["preco", "entrega", "tipo", "plataforma"]}
        className="w-full"
      >
        {/* Preço */}
        <AccordionItem value="preco">
          <AccordionTrigger className="text-sm">Preço</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <Slider defaultValue={[50, 500]} min={0} max={1000} step={10} />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>R$ 50</span>
              <span>R$ 500</span>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Entrega */}
        <AccordionItem value="entrega">
          <AccordionTrigger className="text-sm">Entrega</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <FilterRow>
              <Label htmlFor="f-instant" className="text-sm text-muted-foreground">
                Entrega instantânea
              </Label>
              <Switch id="f-instant" />
            </FilterRow>
            <FilterRow>
              <Label htmlFor="f-24h" className="text-sm text-muted-foreground">
                Até 24 horas
              </Label>
              <Switch id="f-24h" />
            </FilterRow>
          </AccordionContent>
        </AccordionItem>

        {/* Tipo */}
        <AccordionItem value="tipo">
          <AccordionTrigger className="text-sm">Tipo</AccordionTrigger>
          <AccordionContent className="space-y-2 pt-2">
            {types.map((t) => (
              <FilterRow key={t}>
                <div className="flex items-center gap-2">
                  <Checkbox id={`type-${t}`} />
                  <Label htmlFor={`type-${t}`} className="text-sm text-muted-foreground">
                    {t}
                  </Label>
                </div>
              </FilterRow>
            ))}
          </AccordionContent>
        </AccordionItem>

        {/* Região */}
        <AccordionItem value="regiao">
          <AccordionTrigger className="text-sm">Região</AccordionTrigger>
          <AccordionContent className="pt-2">
            <RadioGroup defaultValue="Brasil" className="space-y-2">
              {regions.map((r) => (
                <div key={r} className="flex items-center gap-2">
                  <RadioGroupItem id={`region-${r}`} value={r} />
                  <Label
                    htmlFor={`region-${r}`}
                    className="text-sm text-muted-foreground"
                  >
                    {r}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </AccordionContent>
        </AccordionItem>

        {/* Plataforma */}
        <AccordionItem value="plataforma">
          <AccordionTrigger className="text-sm">Plataforma</AccordionTrigger>
          <AccordionContent className="space-y-2 pt-2">
            {platforms.map((p) => (
              <div key={p} className="flex items-center gap-2">
                <Checkbox id={`plat-${p}`} />
                <Label htmlFor={`plat-${p}`} className="text-sm text-muted-foreground">
                  {p}
                </Label>
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>

        {/* Vendedor */}
        <AccordionItem value="vendedor">
          <AccordionTrigger className="text-sm">Vendedor</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <FilterRow>
              <Label htmlFor="f-verified" className="text-sm text-muted-foreground">
                Apenas verificados
              </Label>
              <Switch id="f-verified" />
            </FilterRow>
            <FilterRow>
              <Label htmlFor="f-top" className="text-sm text-muted-foreground">
                Top vendedores
              </Label>
              <Switch id="f-top" />
            </FilterRow>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </aside>
  );
}

function FilterRow({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-between">{children}</div>;
}
