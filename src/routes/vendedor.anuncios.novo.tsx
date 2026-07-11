import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "motion/react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Image as ImageIcon,
  Package,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Truck,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AuthGate } from "@/components/auth/AuthGate";
import { SellerDashboardLayout } from "@/components/seller-dashboard/SellerDashboardLayout";
import {
  ImageUploader,
  type ImageUploaderItem,
} from "@/components/common/ImageUploader";
import { listingDraftService } from "@/services/listingDraftService";
import { cn } from "@/lib/utils";
import type {
  Category,
  ListingAttributeConfig,
  ListingAttributeValue,
  ListingDeliveryMode,
  ListingDraft,
  ListingModel,
  ListingProductType,
  ListingPromotionTier,
  ListingVariant,
  PromotionTierInfo,
  SellerPlanInfo,
  SellerPlanType,
  Subcategory,
} from "@/types";

import { DynamicItemsEditor } from "@/components/seller-dashboard/listing-wizard/DynamicItemsEditor";
import { ServiceFields } from "@/components/seller-dashboard/listing-wizard/ServiceFields";
import { AccountFields } from "@/components/seller-dashboard/listing-wizard/AccountFields";
import { AttributesFields } from "@/components/seller-dashboard/listing-wizard/AttributesFields";
import { SecureVaultMock } from "@/components/seller-dashboard/listing-wizard/SecureVaultMock";
import { PromotionCards } from "@/components/seller-dashboard/listing-wizard/PromotionCards";
import { LitMaxPlanCard } from "@/components/seller-dashboard/listing-wizard/LitMaxPlanCard";
import { AutomaticMessageField } from "@/components/seller-dashboard/listing-wizard/AutomaticMessageField";
import { NotificationsPrefs } from "@/components/seller-dashboard/listing-wizard/NotificationsPrefs";

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
  { id: 1, label: "Modelo & categoria" },
  { id: 2, label: "Informações" },
  { id: 3, label: "Entrega & estoque" },
  { id: 4, label: "Imagens" },
  { id: 5, label: "Planos" },
  { id: 6, label: "Revisão" },
];

const MODEL_ICON: Record<ListingModel, typeof Package> = {
  normal: Package,
  dynamic: Sparkles,
  service: Zap,
};

const initialDraft: ListingDraft = {
  model: "normal",
  instantDelivery: true,
  deliveryMode: "manual",
  promotionTier: "silver",
  sellerPlan: "standard",
  dynamicItems: [],
  service: {},
  account: {},
  attributes: [],
  secureVaultLines: [],
  galleryImageIds: [],
  notifications: {
    inApp: true,
    browser: false,
    emailFuture: false,
    externalIntegrationFuture: false,
  },
};

function NovoAnuncioPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<ListingDraft>(initialDraft);
  const [cover, setCover] = useState<ImageUploaderItem[]>([]);
  const [gallery, setGallery] = useState<ImageUploaderItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [productTypes, setProductTypes] = useState<
    { id: ListingProductType; name: string }[]
  >([]);
  const [models, setModels] = useState<
    { id: ListingModel; name: string; description: string }[]
  >([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [attrConfig, setAttrConfig] = useState<ListingAttributeConfig[]>([]);
  const [tiers, setTiers] = useState<PromotionTierInfo[]>([]);
  const [plans, setPlans] = useState<SellerPlanInfo[]>([]);

  useEffect(() => {
    let m = true;
    Promise.all([
      listingDraftService.getListingModels(),
      listingDraftService.getProductTypes(),
      listingDraftService.getCategories(),
      listingDraftService.getPromotionTiers(),
      listingDraftService.getSellerPlans(),
    ]).then(([mo, pt, cats, tr, pl]) => {
      if (!m) return;
      setModels(mo);
      setProductTypes(pt);
      setCategories(cats);
      setTiers(tr);
      setPlans(pl);
    });
    return () => {
      m = false;
    };
  }, []);

  useEffect(() => {
    let m = true;
    if (!draft.categorySlug) {
      setSubcategories([]);
      return;
    }
    listingDraftService
      .getSubcategoriesByCategory(draft.categorySlug)
      .then((s) => m && setSubcategories(s));
    return () => {
      m = false;
    };
  }, [draft.categorySlug]);

  useEffect(() => {
    let m = true;
    listingDraftService
      .getAttributesForSubcategory(draft.subcategorySlug, draft.productType)
      .then((c) => m && setAttrConfig(c));
    return () => {
      m = false;
    };
  }, [draft.subcategorySlug, draft.productType]);

  const update = <K extends keyof ListingDraft>(key: K, value: ListingDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const goNext = () => setStep((s) => Math.min(6, s + 1));
  const goPrev = () => setStep((s) => Math.max(1, s - 1));

  const canContinue = useMemo(() => {
    if (step === 1) return !!draft.model && !!draft.categorySlug;
    if (step === 2) {
      if (draft.model === "service")
        return !!draft.service?.title && !!draft.service?.description;
      if (draft.model === "dynamic")
        return (draft.dynamicItems?.length ?? 0) >= 1;
      return !!draft.title && typeof draft.price === "number";
    }
    if (step === 3) return !!draft.deliveryMode;
    return true;
  }, [step, draft]);

  const handleSubmit = async (mode: "draft" | "submit") => {
    setLoading(true);
    try {
      const payload: ListingDraft = {
        ...draft,
        coverImageId: cover[0]?.id,
        galleryImageIds: gallery.map((g) => g.id),
      };
      const res = await listingDraftService.simulateSubmitListingDraft(payload);
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
      description="Fluxo visual/mockado — nenhum anúncio é publicado, nenhum dado é persistido."
      hideCreateCta
    >
      <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-muted-foreground">
        Em produção, alguns tipos de anúncio podem exigir <strong className="text-warning">verificação de identidade</strong>. Nesta demonstração, isso não bloqueia a criação.
      </div>
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
          <div className="space-y-6">
            <SectionTitle
              icon={Sparkles}
              title="Modelo do anúncio"
              description="Escolha o modelo que melhor descreve o que você vai vender."
            />
            <div className="grid gap-3 md:grid-cols-3">
              {models.map((m) => {
                const Icon = MODEL_ICON[m.id];
                const active = draft.model === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => update("model", m.id)}
                    className={cn(
                      "rounded-2xl border p-4 text-left transition-all",
                      active
                        ? "border-primary bg-primary/5 shadow-glow"
                        : "border-border bg-card hover:border-primary/40",
                    )}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      <span className="text-base font-bold text-foreground">
                        {m.name}
                      </span>
                      {active && <Check className="ml-auto h-4 w-4 text-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground">{m.description}</p>
                  </button>
                );
              })}
            </div>

            <Separator />

            <SectionTitle
              icon={Package}
              title="Categoria e tipo do produto"
              description="Ajuda o comprador a encontrar o seu anúncio."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="mb-1.5 block">Categoria</Label>
                <select
                  value={draft.categorySlug ?? ""}
                  onChange={(e) => {
                    update("categorySlug", e.target.value || undefined);
                    update("subcategorySlug", undefined);
                  }}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Selecionar</option>
                  {categories.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="mb-1.5 block">Subcategoria</Label>
                <select
                  value={draft.subcategorySlug ?? ""}
                  onChange={(e) =>
                    update("subcategorySlug", e.target.value || undefined)
                  }
                  disabled={subcategories.length === 0}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
                >
                  <option value="">
                    {subcategories.length === 0
                      ? "Escolha uma categoria primeiro"
                      : "Selecionar"}
                  </option>
                  {subcategories.map((s) => (
                    <option key={s.slug} value={s.slug}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <Label className="mb-1.5 block">Tipo do produto vendido</Label>
                <div className="flex flex-wrap gap-2">
                  {productTypes.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => update("productType", t.id)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm transition-colors",
                        draft.productType === t.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <SectionTitle
              icon={Package}
              title="Informações"
              description={
                draft.model === "service"
                  ? "Descreva o serviço oferecido."
                  : draft.model === "dynamic"
                    ? "Descrição geral do anúncio e variações."
                    : "Descreva o produto e defina preço."
              }
            />

            {draft.model !== "service" && (
              <>
                <div>
                  <Label className="mb-1.5 block">Título</Label>
                  <Input
                    value={draft.title ?? ""}
                    onChange={(e) => update("title", e.target.value)}
                    placeholder="Ex.: Conta Valorant Imortal Full Skins"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block">Descrição</Label>
                  <Textarea
                    rows={4}
                    value={draft.description ?? ""}
                    onChange={(e) => update("description", e.target.value)}
                    placeholder="Detalhe o que está incluído..."
                  />
                </div>
              </>
            )}

            {draft.model === "normal" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="mb-1.5 block">Preço (BRL)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={draft.price ?? ""}
                    onChange={(e) =>
                      update(
                        "price",
                        e.target.value ? Number(e.target.value) : undefined,
                      )
                    }
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block">Estoque</Label>
                  <Input
                    type="number"
                    min={0}
                    value={draft.stock ?? ""}
                    onChange={(e) =>
                      update(
                        "stock",
                        e.target.value ? Number(e.target.value) : undefined,
                      )
                    }
                  />
                </div>
              </div>
            )}

            {draft.model === "dynamic" && (
              <DynamicItemsEditor
                value={draft.dynamicItems ?? []}
                onChange={(v: ListingVariant[]) => update("dynamicItems", v)}
              />
            )}

            {draft.model === "service" && (
              <ServiceFields
                value={draft.service ?? {}}
                onChange={(v) => update("service", v)}
              />
            )}

            {draft.productType === "account" && draft.model !== "service" && (
              <AccountFields
                value={draft.account ?? {}}
                onChange={(v) => update("account", v)}
              />
            )}

            {attrConfig.length > 0 && (
              <AttributesFields
                config={attrConfig}
                value={draft.attributes ?? []}
                onChange={(v: ListingAttributeValue[]) => update("attributes", v)}
              />
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <SectionTitle
              icon={Truck}
              title="Entrega & estoque"
              description="Escolha como o comprador receberá o produto."
            />
            <div className="grid gap-3 md:grid-cols-2">
              {(
                [
                  {
                    id: "manual" as ListingDeliveryMode,
                    title: "Entrega Manual",
                    desc: "Você entrega após a compra. O comprador acompanha pelo pedido.",
                  },
                  {
                    id: "automatic" as ListingDeliveryMode,
                    title: "Entrega Automática",
                    desc: "Prepare um cofre seguro. O sistema entrega uma unidade após o pagamento.",
                  },
                ]
              ).map((opt) => {
                const active = draft.deliveryMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => update("deliveryMode", opt.id)}
                    className={cn(
                      "rounded-2xl border p-4 text-left transition-all",
                      active
                        ? "border-primary bg-primary/5 shadow-glow"
                        : "border-border bg-card hover:border-primary/40",
                    )}
                  >
                    <div className="mb-1 flex items-center gap-2 text-base font-bold text-foreground">
                      {opt.title}
                      {active && <Check className="ml-auto h-4 w-4 text-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
                  </button>
                );
              })}
            </div>

            {draft.deliveryMode === "automatic" && (
              <SecureVaultMock
                value={draft.secureVaultLines ?? []}
                onChange={(v) => update("secureVaultLines", v)}
              />
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <SectionTitle
              icon={ImageIcon}
              title="Imagens"
              description="Separe a imagem de capa das demais. Modo demonstração — nenhum arquivo é enviado."
            />
            <div>
              <Label className="mb-2 block">Imagem de capa</Label>
              <p className="mb-2 text-xs text-muted-foreground">
                Usada no card do produto e nas listagens. Apenas uma imagem.
              </p>
              <ImageUploader value={cover} onChange={setCover} maxImages={1} />
            </div>
            <Separator />
            <div>
              <Label className="mb-2 block">Galeria de imagens</Label>
              <p className="mb-2 text-xs text-muted-foreground">
                Aparecem na página do produto. Até 6 imagens.
              </p>
              <ImageUploader value={gallery} onChange={setGallery} maxImages={6} />
            </div>
            <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
              As imagens desta demonstração não são enviadas para servidor.
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-8">
            <div className="space-y-3">
              <SectionTitle
                icon={Sparkles}
                title="Destaque do anúncio"
                description="Escolha um plano de destaque para aumentar a visibilidade."
              />
              <PromotionCards
                tiers={tiers}
                value={draft.promotionTier}
                onChange={(t: ListingPromotionTier) => update("promotionTier", t)}
              />
            </div>

            <Separator />

            <div className="space-y-3">
              <SectionTitle
                icon={Sparkles}
                title="Plano do vendedor"
                description="LIT-MAX é o plano premium da LIT Buy."
              />
              <LitMaxPlanCard
                plans={plans}
                value={draft.sellerPlan}
                onChange={(p: SellerPlanType) => update("sellerPlan", p)}
              />
              {draft.sellerPlan === "lit_max" && (
                <AutomaticMessageField
                  value={draft.autoMessage ?? ""}
                  onChange={(v) => update("autoMessage", v)}
                />
              )}
            </div>

            <Separator />

            <NotificationsPrefs
              value={
                draft.notifications ?? {
                  inApp: true,
                  browser: false,
                  emailFuture: false,
                  externalIntegrationFuture: false,
                }
              }
              onChange={(v) => update("notifications", v)}
            />
          </div>
        )}

        {step === 6 && (
          <div className="space-y-5">
            <SectionTitle
              icon={ShieldCheck}
              title="Revisão final"
              description="Confira as informações antes de enviar para análise."
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Modelo" value={modelLabel(draft.model)} />
              <Info label="Tipo do produto" value={productTypeLabel(draft.productType, productTypes)} />
              <Info label="Categoria" value={draft.categorySlug ?? "—"} />
              <Info label="Subcategoria" value={draft.subcategorySlug ?? "—"} />
              {draft.model === "normal" && (
                <>
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
                  <Info label="Estoque" value={draft.stock != null ? String(draft.stock) : "—"} />
                </>
              )}
              {draft.model === "dynamic" && (
                <Info
                  label="Variações"
                  value={`${draft.dynamicItems?.length ?? 0} itens`}
                />
              )}
              {draft.model === "service" && (
                <>
                  <Info label="Serviço" value={draft.service?.title ?? "—"} />
                  <Info
                    label="Preço base"
                    value={
                      typeof draft.service?.basePrice === "number"
                        ? draft.service.basePrice.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })
                        : draft.service?.pricingType === "quote"
                          ? "Sob orçamento"
                          : "—"
                    }
                  />
                </>
              )}
              <Info
                label="Entrega"
                value={draft.deliveryMode === "automatic" ? "Automática" : "Manual"}
              />
              <Info
                label="Plano de destaque"
                value={promotionLabel(draft.promotionTier)}
              />
              <Info
                label="Plano do vendedor"
                value={draft.sellerPlan === "lit_max" ? "LIT-MAX" : "Padrão"}
              />
              <Info
                label="Capa"
                value={cover.length > 0 ? "Definida" : "—"}
              />
              <Info label="Galeria" value={`${gallery.length} imagens`} />
            </div>

            {draft.sellerPlan === "lit_max" && draft.autoMessage && (
              <div className="rounded-xl border border-border bg-surface/60 p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Mensagem automática (LIT-MAX)
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                  {draft.autoMessage}
                </p>
              </div>
            )}

            <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Modo demonstração: nenhum anúncio é publicado, nenhuma imagem é
                enviada, nenhum cofre é criado, nenhuma mensagem é enviada e nada
                é persistido.
              </p>
            </div>
          </div>
        )}
      </motion.div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" onClick={goPrev} disabled={step === 1}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
        {step < 6 ? (
          <Button onClick={goNext} disabled={!canContinue}>
            Continuar <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => handleSubmit("draft")}
              disabled={loading}
            >
              <Save className="mr-2 h-4 w-4" /> Salvar rascunho
            </Button>
            <Button onClick={() => handleSubmit("submit")} disabled={loading}>
              <Send className="mr-2 h-4 w-4" /> Enviar para análise
            </Button>
          </div>
        )}
      </div>
    </SellerDashboardLayout>
  );
}

function SectionTitle({
  title,
  description,
  icon: Icon = Package,
}: {
  title: string;
  description?: string;
  icon?: typeof Package;
}) {
  return (
    <header className="space-y-1">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-lg font-bold text-foreground">{title}</h3>
        <Badge variant="secondary" className="ml-1 text-[10px]">
          Demo
        </Badge>
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
      <div className="mt-0.5 truncate text-sm font-medium text-foreground">
        {value}
      </div>
    </div>
  );
}

function modelLabel(m?: ListingModel) {
  if (m === "dynamic") return "Dinâmico";
  if (m === "service") return "Serviço";
  if (m === "normal") return "Normal";
  return "—";
}

function productTypeLabel(
  t: ListingProductType | undefined,
  list: { id: ListingProductType; name: string }[],
) {
  return list.find((x) => x.id === t)?.name ?? "—";
}

function promotionLabel(t?: ListingPromotionTier) {
  if (t === "gold") return "Ouro";
  if (t === "diamond") return "Diamante";
  if (t === "silver") return "Prata";
  return "—";
}
