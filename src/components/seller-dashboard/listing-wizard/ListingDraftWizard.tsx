import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Eye, Images, PackageCheck, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { AccountFields } from "./AccountFields";
import { AttributesFields } from "./AttributesFields";
import { AutomaticMessageField } from "./AutomaticMessageField";
import { DynamicItemsEditor } from "./DynamicItemsEditor";
import { LitMaxPlanCard } from "./LitMaxPlanCard";
import { NotificationsPrefs } from "./NotificationsPrefs";
import { PromotionCards } from "./PromotionCards";
import { ServiceFields } from "./ServiceFields";
import {
  EMPTY_DRAFT_ID,
  emptyListingDraftFormState,
  filterAttributesForConfig,
  formStateToDraftPayload,
  sellerDraftDetailToFormState,
  type ListingDraftFormState,
} from "./listingDraftFormAdapters";
import { ImageUploader, type ImageUploaderItem } from "@/components/common/ImageUploader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { catalogService } from "@/services/catalogService";
import { listingDraftApiService, type ListingDraftRecord } from "@/services/listingDraftApiService";
import type {
  Category,
  ListingAttributeConfig,
  ListingModel,
  ListingProductType,
  PromotionTierInfo,
  SellerPlanInfo,
  Subcategory,
} from "@/types";

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "conflict" | "error";

type StepId = 1 | 2 | 3 | 4 | 5 | 6;

const steps: { id: StepId; title: string; description: string }[] = [
  { id: 1, title: "Classificação", description: "Modelo e taxonomia real" },
  { id: 2, title: "Informações", description: "Dados e atributos" },
  { id: 3, title: "Entrega", description: "Manual agora, automática futura" },
  { id: 4, title: "Imagens", description: "Previews locais" },
  { id: 5, title: "Preferências", description: "Sem cobrança real" },
  { id: 6, title: "Revisão", description: "Resumo antes da análise" },
];

const statusLabel: Record<SaveState, string> = {
  idle: "Não salvo",
  dirty: "Não salvo",
  saving: "Salvando…",
  saved: "Salvo",
  conflict: "Conflito — recarregue",
  error: "Erro ao salvar",
};

const moderationStatusLabel: Record<ListingDraftRecord["status"], string> = {
  DRAFT: "Rascunho editável",
  REJECTED: "Rejeitado — corrija e reenvie",
  PENDING_REVIEW: "Pendente de análise — somente leitura",
  UNDER_REVIEW: "Em análise — somente leitura",
  APPROVED: "Aprovado pela moderação — ainda não publicado",
};

const promotionTiers: PromotionTierInfo[] = [
  {
    tier: "silver",
    name: "Prata",
    tagline: "Preferência demonstrativa básica.",
    benefits: ["Não concede destaque real", "Não altera taxa", "Persistido apenas para retomar"],
    demoFeePct: 0,
  },
  {
    tier: "gold",
    name: "Ouro",
    tagline: "Preferência visual intermediária.",
    benefits: ["Sem cobrança", "Sem prioridade real", "Sem entitlement comercial"],
    demoFeePct: 0,
    recommended: true,
  },
  {
    tier: "diamond",
    name: "Diamante",
    tagline: "Preferência futura de destaque.",
    benefits: ["Não publica", "Não cobra", "Não muda busca pública"],
    demoFeePct: 0,
  },
];

const sellerPlans: SellerPlanInfo[] = [
  {
    plan: "standard",
    name: "Padrão",
    tagline: "Preferência padrão sem assinatura ativa.",
    benefits: ["Sem assinatura real", "Sem cobrança", "Sem mudança de taxa"],
  },
  {
    plan: "lit_max",
    name: "LIT-MAX",
    tagline: "Preferência futura, ainda sem benefício comercial.",
    benefits: [
      "Não envia mensagem automaticamente",
      "Não ativa plano pago",
      "Não prioriza análise",
    ],
    premium: true,
  },
];

function readonlyStatus(status: ListingDraftRecord["status"]) {
  return ["PENDING_REVIEW", "UNDER_REVIEW", "APPROVED"].includes(status);
}

function numberToMoney(value: string) {
  if (!value.trim()) return "";
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : value;
}

export function ListingDraftWizard({ initialDraft }: { initialDraft?: ListingDraftRecord }) {
  const navigate = useNavigate();
  const [form, setForm] = useState<ListingDraftFormState>(() =>
    initialDraft ? sellerDraftDetailToFormState(initialDraft) : emptyListingDraftFormState(),
  );
  const [persistedDraft, setPersistedDraft] = useState<ListingDraftRecord | undefined>(
    initialDraft,
  );
  const [saveState, setSaveState] = useState<SaveState>(initialDraft ? "saved" : "idle");
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [attributesConfig, setAttributesConfig] = useState<ListingAttributeConfig[]>([]);
  const [productTypes, setProductTypes] = useState<{ id: ListingProductType; name: string }[]>([]);
  const [cover, setCover] = useState<ImageUploaderItem[]>([]);
  const [gallery, setGallery] = useState<ImageUploaderItem[]>([]);
  const [taxonomyLoading, setTaxonomyLoading] = useState(false);
  const [submitPending, setSubmitPending] = useState(false);
  const subcategorySequence = useRef(0);
  const attributesSequence = useRef(0);

  const isPersisted = Boolean(form.id && form.id !== EMPTY_DRAFT_ID);
  const readOnly = readonlyStatus(form.status);
  const editable = !readOnly;

  const markDirty = useCallback(() => {
    if (!readOnly) setSaveState((current) => (current === "saving" ? current : "dirty"));
  }, [readOnly]);

  const patchForm = useCallback(
    (patch: Partial<ListingDraftFormState>) => {
      if (readOnly) return;
      setForm((current) => ({ ...current, ...patch }));
      markDirty();
    },
    [markDirty, readOnly],
  );

  useEffect(() => {
    Promise.all([catalogService.getCategories(), catalogService.getProductTypes()])
      .then(([nextCategories, nextProductTypes]) => {
        setCategories(nextCategories);
        setProductTypes(nextProductTypes);
      })
      .catch(() => toast.error("Falha ao carregar taxonomia"));
  }, []);

  useEffect(() => {
    const sequence = ++subcategorySequence.current;
    if (!form.categorySlug) {
      setSubcategories([]);
      return;
    }
    catalogService
      .getSubcategoriesByCategory(form.categorySlug)
      .then((next) => {
        if (sequence === subcategorySequence.current) setSubcategories(next);
      })
      .catch(() => {
        if (sequence === subcategorySequence.current) setSubcategories([]);
      });
  }, [form.categorySlug]);

  useEffect(() => {
    const sequence = ++attributesSequence.current;
    setTaxonomyLoading(true);
    catalogService
      .getAttributesForSubcategory(
        form.categorySlug ?? undefined,
        form.subcategorySlug ?? undefined,
        form.productType ?? undefined,
      )
      .then((next) => {
        if (sequence !== attributesSequence.current) return;
        setAttributesConfig(next);
        setForm((current) => ({
          ...current,
          attributes: filterAttributesForConfig(current.attributes, next),
        }));
      })
      .catch(() => {
        if (sequence === attributesSequence.current) setAttributesConfig([]);
      })
      .finally(() => {
        if (sequence === attributesSequence.current) setTaxonomyLoading(false);
      });
  }, [form.categorySlug, form.subcategorySlug, form.productType]);

  useEffect(() => {
    if (saveState !== "dirty") return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saveState]);

  const setStep = (step: StepId) => patchForm({ step });
  const next = () => setStep(Math.min(6, form.step + 1) as StepId);
  const previous = () => setStep(Math.max(1, form.step - 1) as StepId);

  const changeModel = (model: ListingModel) => {
    const cleanup: Partial<ListingDraftFormState> = { model };
    if (model === "normal") Object.assign(cleanup, { variants: [], service: {} });
    if (model === "dynamic") Object.assign(cleanup, { price: "", stock: "", service: {} });
    if (model === "service") {
      Object.assign(cleanup, {
        price: "",
        stock: "",
        variants: [],
        account: {},
        productType: "service",
      });
    }
    patchForm(cleanup);
  };

  const changeCategory = (categoryId: string) => {
    const category = categories.find((candidate) => candidate.id === categoryId) ?? null;
    patchForm({
      categoryId: category?.id ?? null,
      categorySlug: category?.slug ?? null,
      categoryName: category?.name ?? null,
      subcategoryId: null,
      subcategorySlug: null,
      subcategoryName: null,
      attributes: [],
    });
  };

  const changeSubcategory = (subcategoryId: string) => {
    const subcategory = subcategories.find((candidate) => candidate.id === subcategoryId) ?? null;
    patchForm({
      subcategoryId: subcategory?.id ?? null,
      subcategorySlug: subcategory?.slug ?? null,
      subcategoryName: subcategory?.name ?? null,
      attributes: filterAttributesForConfig(form.attributes, attributesConfig),
    });
  };

  const changeProductType = (productType: ListingProductType) => {
    patchForm({
      productType,
      attributes: [],
      account: productType === "account" ? form.account : {},
    });
  };

  const payload = useMemo(() => formStateToDraftPayload({ ...form, step: form.step }), [form]);

  async function save(): Promise<ListingDraftRecord | null> {
    if (!editable) return null;
    setSaveState("saving");
    try {
      const saved = isPersisted
        ? await listingDraftApiService.update(form.id!, form.version, payload)
        : await listingDraftApiService.create(payload);
      setPersistedDraft(saved);
      setForm(sellerDraftDetailToFormState(saved));
      setSaveState("saved");
      toast.success("Rascunho persistido", {
        description: "Imagens locais, arquivos e cofre não foram enviados nem salvos.",
      });
      if (!isPersisted)
        await navigate({ to: "/vendedor/anuncios/$id/editar", params: { id: saved.id } });
      return saved;
    } catch (error) {
      const apiError = error as { code?: string; message?: string };
      setSaveState(apiError.code === "LISTING_DRAFT_VERSION_CONFLICT" ? "conflict" : "error");
      toast.error(apiError.message ?? "Erro ao salvar rascunho");
      return null;
    }
  }

  async function submit() {
    if (!editable || submitPending) return;
    if (form.deliveryMode === "automatic") {
      toast.error("Entrega automática indisponível", {
        description: "Somente entrega manual pode ser enviada para análise nesta sprint.",
      });
      return;
    }
    setSubmitPending(true);
    try {
      const current =
        saveState === "dirty" || !isPersisted ? await save() : (persistedDraft ?? null);
      if (!current) return;
      const submitted = await listingDraftApiService.submit(current.id, current.version);
      setPersistedDraft(submitted);
      setForm(sellerDraftDetailToFormState(submitted));
      setSaveState("saved");
      toast.success("Enviado para análise");
      await navigate({ to: "/vendedor/anuncios" });
    } catch (error) {
      const apiError = error as { message?: string };
      toast.error(apiError.message ?? "Falha ao enviar para análise");
    } finally {
      setSubmitPending(false);
    }
  }

  const stepContent = (() => {
    switch (form.step) {
      case 1:
        return (
          <section className="space-y-5" aria-labelledby="classification-title">
            <div>
              <h2 id="classification-title" className="text-xl font-semibold">
                Etapa 1 — Classificação
              </h2>
              <p className="text-sm text-muted-foreground">
                Escolha o modelo, categoria, subcategoria e product type usando a taxonomia real.
              </p>
            </div>
            <fieldset disabled={!editable} className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="mb-1.5 block">Modelo do anúncio</Label>
                <Select
                  value={form.model}
                  onValueChange={(value) => changeModel(value as ListingModel)}
                >
                  <SelectTrigger aria-label="Modelo do anúncio">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="dynamic">Dinâmico</SelectItem>
                    <SelectItem value="service">Serviço</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block">Categoria</Label>
                <Select value={form.categoryId ?? ""} onValueChange={changeCategory}>
                  <SelectTrigger aria-label="Categoria">
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block">Subcategoria</Label>
                <Select value={form.subcategoryId ?? ""} onValueChange={changeSubcategory}>
                  <SelectTrigger aria-label="Subcategoria">
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    {subcategories
                      .filter((subcategory) => subcategory.id)
                      .map((subcategory) => (
                        <SelectItem key={subcategory.id} value={subcategory.id!}>
                          {subcategory.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block">Product type</Label>
                <Select
                  value={form.productType ?? ""}
                  onValueChange={(value) => changeProductType(value as ListingProductType)}
                >
                  <SelectTrigger aria-label="Product type">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {productTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </fieldset>
          </section>
        );
      case 2:
        return (
          <section className="space-y-5" aria-labelledby="info-title">
            <div>
              <h2 id="info-title" className="text-xl font-semibold">
                Etapa 2 — Informações do anúncio
              </h2>
              <p className="text-sm text-muted-foreground">
                O conteúdo muda pelo modelo selecionado; o backend revalida tudo ao salvar, enviar e
                aprovar.
              </p>
            </div>
            <fieldset disabled={!editable} className="space-y-4">
              {form.model === "service" ? (
                <ServiceFields
                  value={form.service}
                  onChange={(service) => patchForm({ service })}
                />
              ) : (
                <>
                  <div>
                    <Label className="mb-1.5 block">Título</Label>
                    <Input
                      value={form.title}
                      onChange={(event) => patchForm({ title: event.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5 block">Descrição</Label>
                    <Textarea
                      rows={5}
                      value={form.description}
                      onChange={(event) => patchForm({ description: event.target.value })}
                    />
                  </div>
                  {form.model === "normal" && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label className="mb-1.5 block">Preço</Label>
                        <Input
                          value={form.price}
                          inputMode="decimal"
                          onBlur={() => patchForm({ price: numberToMoney(form.price) })}
                          onChange={(event) => patchForm({ price: event.target.value })}
                          placeholder="349.90"
                        />
                      </div>
                      <div>
                        <Label className="mb-1.5 block">Estoque</Label>
                        <Input
                          type="number"
                          min={0}
                          value={form.stock}
                          onChange={(event) => patchForm({ stock: event.target.value })}
                        />
                      </div>
                    </div>
                  )}
                  {form.model === "dynamic" && (
                    <DynamicItemsEditor
                      value={form.variants}
                      onChange={(variants) => patchForm({ variants })}
                    />
                  )}
                </>
              )}
              {form.productType === "account" && form.model !== "service" && (
                <AccountFields
                  value={form.account}
                  onChange={(account) => patchForm({ account })}
                />
              )}
              {taxonomyLoading ? (
                <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  Carregando atributos da taxonomia…
                </div>
              ) : (
                <AttributesFields
                  config={attributesConfig}
                  value={form.attributes}
                  onChange={(attributes) => patchForm({ attributes })}
                />
              )}
            </fieldset>
          </section>
        );
      case 3:
        return (
          <section className="space-y-5" aria-labelledby="delivery-title">
            <div>
              <h2 id="delivery-title" className="text-xl font-semibold">
                Etapa 3 — Entrega
              </h2>
              <p className="text-sm text-muted-foreground">
                Somente entrega manual pode ser submetida nesta sprint.
              </p>
            </div>
            <fieldset disabled={!editable} className="grid gap-4 md:grid-cols-2">
              <button
                type="button"
                onClick={() => patchForm({ deliveryMode: "manual" })}
                className={`rounded-2xl border p-4 text-left ${form.deliveryMode === "manual" ? "border-primary bg-primary/5" : "bg-card"}`}
              >
                <PackageCheck className="mb-2 h-5 w-5 text-primary" />
                <div className="font-semibold">Entrega manual</div>
                <p className="text-sm text-muted-foreground">
                  Preferência suportada para submissão e moderação.
                </p>
              </button>
              <button
                type="button"
                onClick={() => patchForm({ deliveryMode: "automatic" })}
                className={`rounded-2xl border p-4 text-left ${form.deliveryMode === "automatic" ? "border-warning bg-warning/5" : "bg-card"}`}
              >
                <AlertTriangle className="mb-2 h-5 w-5 text-warning" />
                <div className="font-semibold">Entrega automática — Em breve</div>
                <p className="text-sm text-muted-foreground">
                  A entrega automática ainda não está disponível. Nenhuma credencial ou código deve
                  ser informado.
                </p>
              </button>
            </fieldset>
          </section>
        );
      case 4:
        return (
          <section className="space-y-5" aria-labelledby="images-title">
            <div>
              <h2 id="images-title" className="text-xl font-semibold">
                Etapa 4 — Imagens
              </h2>
              <p className="text-sm text-muted-foreground">
                As imagens são previews locais. Elas não são enviadas nem fazem parte do rascunho
                persistido.
              </p>
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <Label className="mb-2 block">Capa local</Label>
                <ImageUploader value={cover} onChange={setCover} maxImages={1} />
              </div>
              <div>
                <Label className="mb-2 block">Galeria local</Label>
                <ImageUploader value={gallery} onChange={setGallery} maxImages={6} />
              </div>
            </div>
          </section>
        );
      case 5:
        return (
          <section className="space-y-5" aria-labelledby="prefs-title">
            <div>
              <h2 id="prefs-title" className="text-xl font-semibold">
                Etapa 5 — Preferências
              </h2>
              <p className="text-sm text-muted-foreground">
                Preferências persistidas para retomar o wizard; não há cobrança, taxa, prioridade,
                assinatura ou benefício real.
              </p>
            </div>
            <fieldset disabled={!editable} className="space-y-5">
              <PromotionCards
                tiers={promotionTiers}
                value={form.promotionTier}
                onChange={(promotionTier) => patchForm({ promotionTier })}
              />
              <LitMaxPlanCard
                plans={sellerPlans}
                value={form.sellerPlan}
                onChange={(sellerPlan) => patchForm({ sellerPlan })}
              />
              <AutomaticMessageField
                value={form.autoMessage}
                onChange={(autoMessage) => patchForm({ autoMessage })}
              />
              <NotificationsPrefs
                value={form.notifications}
                onChange={(notifications) => patchForm({ notifications })}
              />
            </fieldset>
          </section>
        );
      case 6:
        return (
          <section className="space-y-5" aria-labelledby="review-title">
            <div>
              <h2 id="review-title" className="text-xl font-semibold">
                Etapa 6 — Revisão
              </h2>
              <p className="text-sm text-muted-foreground">
                Confira o resumo completo antes de enviar para análise.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <ReviewCard
                title="Classificação"
                rows={[
                  ["Modelo", form.model],
                  ["Categoria", form.categoryName ?? "—"],
                  ["Subcategoria", form.subcategoryName ?? "—"],
                  ["Product type", form.productType ?? "—"],
                ]}
              />
              <ReviewCard
                title="Informações"
                rows={[
                  [
                    "Título",
                    form.model === "service" ? form.service.title || "—" : form.title || "—",
                  ],
                  [
                    "Descrição",
                    form.model === "service"
                      ? form.service.description || "—"
                      : form.description || "—",
                  ],
                  ["Preço", form.model === "normal" ? form.price || "—" : "Não aplicável"],
                  ["Estoque", form.model === "normal" ? form.stock || "—" : "Não aplicável"],
                ]}
              />
              <ReviewCard
                title="Entrega e imagens"
                rows={[
                  ["Entrega", form.deliveryMode],
                  ["Previews locais", `${cover.length + gallery.length} imagem(ns)`],
                  ["Upload/storage", "Não implementado"],
                ]}
              />
              <ReviewCard
                title="Preferências"
                rows={[
                  ["Destaque solicitado", form.promotionTier],
                  ["Plano solicitado", form.sellerPlan],
                  ["Mensagem automática", form.autoMessage ? "Preenchida (não enviada)" : "—"],
                  [
                    "Notificações",
                    `${form.notifications.inApp ? "app " : ""}${form.notifications.browser ? "browser " : ""}`.trim() ||
                      "—",
                  ],
                ]}
              />
            </div>
            {form.variants.length > 0 && (
              <ReviewList
                title="Variantes"
                items={form.variants.map(
                  (variant, index) =>
                    `${index + 1}. ${variant.title || "Sem título"} — R$ ${variant.price} — estoque ${variant.stock} — ${variant.status}`,
                )}
              />
            )}
            {form.attributes.length > 0 && (
              <ReviewList
                title="Atributos"
                items={form.attributes.map((attribute) => `${attribute.key}: ${attribute.value}`)}
              />
            )}
            {form.productType === "account" && (
              <ReviewList
                title="Declarações de conta"
                items={[
                  `Procedência: ${form.account.provenance ?? "—"}`,
                  `Recuperação: ${form.account.recoveryLevel ?? "—"}`,
                  `Risco: ${form.account.recoveryRisk ?? "—"}`,
                  `Observação: ${form.account.warrantyNote || "—"}`,
                ]}
              />
            )}
            <div className="space-y-2 rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm text-warning">
              <p>A aprovação da moderação não publica o anúncio.</p>
              <p>Imagens locais não serão salvas nesta etapa.</p>
              <p>Não existe produto público, checkout ou pagamento nesta fundação.</p>
            </div>
          </section>
        );
    }
  })();

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-muted-foreground">
        A aprovação desta etapa não publica o anúncio no marketplace. Imagens são previews locais;
        upload, cofre, publicação, checkout e pagamento são futuros.
      </div>
      {form.status === "REJECTED" && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
          <b>Rejeitado:</b> {form.rejectionCode} — {form.rejectionReason}. Corrija e reenvie na
          revisão.
        </div>
      )}
      {form.status === "APPROVED" && (
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm">
          Aprovado pela moderação. A publicação pública ainda não está disponível.
        </div>
      )}
      <div className="rounded-2xl border bg-card p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">{moderationStatusLabel[form.status]}</p>
            <p className="text-xs text-muted-foreground">
              {statusLabel[saveState]} · versão {form.version}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" disabled={form.step <= 1} onClick={previous}>
              Voltar
            </Button>
            <Button variant="outline" disabled={form.step >= 6} onClick={next}>
              Avançar
            </Button>
          </div>
        </div>
        <ol className="grid gap-2 md:grid-cols-6">
          {steps.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setStep(item.id)}
                className={`h-full w-full rounded-xl border p-3 text-left text-xs ${form.step === item.id ? "border-primary bg-primary/5" : "bg-background"}`}
              >
                <span className="font-semibold">
                  {item.id}. {item.title}
                </span>
                <span className="mt-1 block text-muted-foreground">{item.description}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="rounded-2xl border bg-card p-5">{stepContent}</div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={!editable || saveState === "saving"}>
          <Save className="mr-2 h-4 w-4" /> Salvar rascunho
        </Button>
        {form.step === 6 && (
          <Button
            onClick={submit}
            disabled={
              !editable ||
              saveState === "saving" ||
              submitPending ||
              form.deliveryMode === "automatic"
            }
          >
            <Send className="mr-2 h-4 w-4" /> Enviar para análise
          </Button>
        )}
        {readOnly && (
          <Button asChild variant="outline">
            <Link to="/vendedor/anuncios">
              <Eye className="mr-2 h-4 w-4" /> Voltar à listagem
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

function ReviewCard({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <h3 className="mb-3 flex items-center gap-2 font-semibold">
        <CheckCircle2 className="h-4 w-4 text-primary" />
        {title}
      </h3>
      <dl className="space-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ReviewList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <h3 className="mb-3 flex items-center gap-2 font-semibold">
        <Images className="h-4 w-4 text-primary" />
        {title}
      </h3>
      <ul className="space-y-1 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
