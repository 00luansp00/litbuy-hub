import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "motion/react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Package,
  Save,
  Send,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { AuthGate } from "@/components/auth/AuthGate";
import { SellerDashboardLayout } from "@/components/seller-dashboard/SellerDashboardLayout";
import {
  ImageUploader,
  type ImageUploaderItem,
} from "@/components/common/ImageUploader";
import { sellerDashboardService } from "@/services/sellerDashboardService";
import { cn } from "@/lib/utils";
import type { CreateListingDraft } from "@/types";


export const Route = createFileRoute("/vendedor/anuncios/novo")({
  component: () => (
    <AuthGate
      title="Entre para criar um anúncio"
      description="Você precisa estar logado para publicar produtos na LIT Buy."
    >
      <NovoAnuncioPage />
    </AuthGate>
  ),
});

const STEPS = [
  { id: 1, label: "Categoria" },
  { id: 2, label: "Informações" },
  { id: 3, label: "Imagens" },
  { id: 4, label: "Revisão" },
];

const CATEGORIES = [
  { slug: "contas", label: "Contas" },
  { slug: "gift-cards", label: "Gift Cards" },
  { slug: "moedas", label: "Moedas" },
  { slug: "skins", label: "Skins" },
  { slug: "servicos", label: "Serviços" },
];

const PLATFORMS = ["PC/Steam", "PlayStation", "Xbox", "Nintendo", "Mobile"];
const KINDS = ["Novo", "Usado", "Digital"];

function NovoAnuncioPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<CreateListingDraft>({ instantDelivery: true });
  const [images, setImages] = useState<ImageUploaderItem[]>([]);
  const [loading, setLoading] = useState(false);

  const update = <K extends keyof CreateListingDraft>(
    key: K,
    value: CreateListingDraft[K],
  ) => setDraft((d) => ({ ...d, [key]: value }));


  const goNext = () => setStep((s) => Math.min(4, s + 1));
  const goPrev = () => setStep((s) => Math.max(1, s - 1));

  const handleSave = async (mode: "draft" | "submit") => {
    setLoading(true);
    try {
      const res = await sellerDashboardService.createListingDraft(draft);
      toast.success(
        mode === "draft"
          ? "Rascunho salvo em modo demonstração"
          : "Anúncio enviado para análise (demo)",
        { description: `ID fictício: ${res.draftId}` },
      );
      navigate({ to: "/vendedor/anuncios" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SellerDashboardLayout
      title="Criar anúncio"
      description="Fluxo visual — nenhum anúncio é publicado de verdade nesta demonstração."
      hideCreateCta
    >
      {/* Steps */}
      <ol className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
        {STEPS.map((s, i) => {
          const done = step > s.id;
          const active = step === s.id;
          return (
            <li key={s.id} className="flex items-center gap-2">
              <span
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-full border font-semibold",
                  done && "border-success bg-success text-success-foreground",
                  active && "border-primary bg-primary text-primary-foreground",
                  !done && !active && "border-border bg-card text-muted-foreground",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : s.id}
              </span>
              <span
                className={cn(
                  "hidden sm:inline",
                  active ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <span className="mx-1 h-px w-6 bg-border sm:w-10" aria-hidden />
              )}
            </li>
          );
        })}
      </ol>

      <motion.div
        key={step}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="rounded-2xl border border-border bg-card p-5 shadow-card md:p-6"
      >
        {step === 1 && (
          <div className="space-y-5">
            <SectionTitle title="Categoria" description="Escolha a categoria e detalhes do produto." />
            <div>
              <Label className="mb-2 block">Categoria</Label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.slug}
                    type="button"
                    onClick={() => update("categorySlug", c.slug)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition-colors",
                      draft.categorySlug === c.slug
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="platform" className="mb-2 block">
                  Jogo / plataforma
                </Label>
                <select
                  id="platform"
                  value={draft.platform ?? ""}
                  onChange={(e) => update("platform", e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Selecionar</option>
                  {PLATFORMS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="kind" className="mb-2 block">
                  Tipo de anúncio
                </Label>
                <select
                  id="kind"
                  value={draft.listingKind ?? ""}
                  onChange={(e) => update("listingKind", e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Selecionar</option>
                  {KINDS.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <SectionTitle title="Informações" description="Descreva o produto e defina preço." />
            <div>
              <Label htmlFor="title" className="mb-2 block">Título</Label>
              <Input
                id="title"
                value={draft.title ?? ""}
                onChange={(e) => update("title", e.target.value)}
                placeholder="Ex.: Conta Valorant Imortal Full Skins"
              />
            </div>
            <div>
              <Label htmlFor="desc" className="mb-2 block">Descrição</Label>
              <Textarea
                id="desc"
                rows={5}
                value={draft.description ?? ""}
                onChange={(e) => update("description", e.target.value)}
                placeholder="Detalhe o que está incluído no produto..."
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="price" className="mb-2 block">Preço (BRL)</Label>
                <Input
                  id="price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={draft.price ?? ""}
                  onChange={(e) =>
                    update("price", e.target.value ? Number(e.target.value) : undefined)
                  }
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label htmlFor="stock" className="mb-2 block">Estoque</Label>
                <Input
                  id="stock"
                  type="number"
                  min={0}
                  value={draft.stock ?? ""}
                  onChange={(e) =>
                    update("stock", e.target.value ? Number(e.target.value) : undefined)
                  }
                  placeholder="1"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface/40 p-3">
              <Switch
                id="instant"
                checked={!!draft.instantDelivery}
                onCheckedChange={(v) => update("instantDelivery", v)}
              />
              <Label htmlFor="instant" className="flex-1 cursor-pointer">
                <span className="text-sm font-medium text-foreground">
                  Entrega instantânea
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Ative se o produto é liberado automaticamente após o pagamento.
                </span>
              </Label>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <SectionTitle
              title="Imagens"
              description="Adicione até 6 imagens do produto. Modo demonstração — nenhum arquivo é enviado."
            />
            <ImageUploader
              value={images}
              onChange={setImages}
              maxImages={6}
            />
          </div>
        )}


        {step === 4 && (
          <div className="space-y-5">
            <SectionTitle title="Revisão" description="Confira as informações antes de enviar." />
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Categoria" value={draft.categorySlug ?? "—"} />
              <Info label="Plataforma" value={draft.platform ?? "—"} />
              <Info label="Tipo" value={draft.listingKind ?? "—"} />
              <Info label="Título" value={draft.title ?? "—"} />
              <Info
                label="Preço"
                value={
                  typeof draft.price === "number"
                    ? draft.price.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })
                    : "—"
                }
              />
              <Info
                label="Estoque"
                value={typeof draft.stock === "number" ? String(draft.stock) : "—"}
              />
              <Info
                label="Entrega instantânea"
                value={draft.instantDelivery ? "Sim" : "Não"}
              />
            </div>

            <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Modo demonstração: nenhum anúncio é publicado, nenhuma imagem é enviada
                e nenhum dado é persistido.
              </p>
            </div>
          </div>
        )}
      </motion.div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" onClick={goPrev} disabled={step === 1}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
        {step < 4 ? (
          <Button onClick={goNext}>
            Continuar <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => handleSave("draft")} disabled={loading}>
              <Save className="mr-2 h-4 w-4" /> Salvar rascunho
            </Button>
            <Button onClick={() => handleSave("submit")} disabled={loading}>
              <Send className="mr-2 h-4 w-4" /> Enviar para análise
            </Button>
          </div>
        )}
      </div>
    </SellerDashboardLayout>
  );
}

function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <header className="space-y-1">
      <div className="flex items-center gap-2">
        <Package className="h-4 w-4 text-primary" />
        <h3 className="text-lg font-bold text-foreground">{title}</h3>
        <Badge variant="secondary" className="ml-1 text-[10px]">Demo</Badge>
      </div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      <Separator className="mt-3" />
    </header>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface/60 p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}
