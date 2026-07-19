import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageUploader, type ImageUploaderItem } from "@/components/common/ImageUploader";
import { catalogService } from "@/services/catalogService";
import {
  listingDraftApiService,
  type DraftPayload,
  type ListingDraftRecord,
} from "@/services/listingDraftApiService";
import type { Category, ListingProductType, Subcategory } from "@/types";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "conflict" | "error";
const statusLabel: Record<string, string> = {
  idle: "Não salvo",
  dirty: "Não salvo",
  saving: "Salvando…",
  saved: "Salvo",
  conflict: "Conflito — recarregue",
  error: "Erro ao salvar",
};
export function ListingDraftWizard({ initialDraft }: { initialDraft?: ListingDraftRecord }) {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<ListingDraftRecord | undefined>(initialDraft);
  const [state, setState] = useState<SaveState>(initialDraft ? "saved" : "idle");
  const [step, setStep] = useState(initialDraft?.wizardStep ?? 1);
  const [cover, setCover] = useState<ImageUploaderItem[]>([]);
  const [gallery, setGallery] = useState<ImageUploaderItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subs, setSubs] = useState<Subcategory[]>([]);
  const [attrs, setAttrs] = useState<
    {
      key: string;
      label: string;
      type: "text" | "number" | "select" | "boolean";
      required?: boolean;
      options?: string[];
    }[]
  >([]);
  const [productTypes, setProductTypes] = useState<{ id: ListingProductType; name: string }[]>([]);
  const editable = !draft || ["DRAFT", "REJECTED"].includes(draft.status);
  const payload = useMemo<DraftPayload>(
    () => ({
      model: draft?.model ?? "NORMAL",
      categoryId: draft?.categoryId ?? null,
      subcategoryId: draft?.subcategoryId ?? null,
      productType: draft?.productType ?? null,
      title: draft?.title ?? null,
      description: draft?.description ?? null,
      price: draft?.price ?? null,
      stock: draft?.stock ?? null,
      deliveryMode: draft?.deliveryMode ?? "MANUAL",
      requestedPromotionTier: draft?.requestedPromotionTier ?? "SILVER",
      requestedSellerPlan: draft?.requestedSellerPlan ?? "STANDARD",
      autoMessage: draft?.autoMessage ?? null,
      wizardStep: step,
      attributes: draft?.attributes ?? [],
      variants:
        draft?.variants?.map((v) => ({
          title: v.title,
          description: v.description,
          price: v.price,
          stock: v.stock,
          status: v.status,
          sortOrder: v.sortOrder,
        })) ?? [],
      serviceDetails:
        draft?.model === "SERVICE"
          ? (draft.serviceDetails ?? {
              title: draft.title,
              description: draft.description,
              pricingType: "FIXED",
              basePrice: draft.price,
            })
          : null,
      accountDetails: draft?.productType === "account" ? draft.accountDetails : null,
    }),
    [draft, step],
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
    if (!draft?.category?.slug) {
      setSubs([]);
      return;
    }
    catalogService
      .getSubcategoriesByCategory(draft.category.slug)
      .then(setSubs)
      .catch(() => setSubs([]));
  }, [draft?.category?.slug]);
  useEffect(() => {
    catalogService
      .getAttributesForSubcategory(
        draft?.category?.slug,
        draft?.subcategory?.slug,
        draft?.productType ?? undefined,
      )
      .then(setAttrs)
      .catch(() => setAttrs([]));
  }, [draft?.category?.slug, draft?.subcategory?.slug, draft?.productType]);
  function patch(p: Partial<ListingDraftRecord>) {
    setDraft((d) => ({ ...(d ?? blank()), ...p }) as ListingDraftRecord);
    setState("dirty");
  }
  function blank(): ListingDraftRecord {
    return {
      id: "00000000-0000-4000-8000-000000000000",
      status: "DRAFT",
      model: "NORMAL",
      title: null,
      description: null,
      category: null,
      subcategory: null,
      categoryId: null,
      subcategoryId: null,
      productType: null,
      price: null,
      stock: null,
      deliveryMode: "MANUAL",
      requestedPromotionTier: "SILVER",
      requestedSellerPlan: "STANDARD",
      autoMessage: null,
      notifications: {
        inApp: true,
        browser: false,
        emailFuture: false,
        externalIntegrationFuture: false,
      },
      wizardStep: step,
      version: 1,
      submittedAt: null,
      updatedAt: new Date().toISOString(),
      rejectionCode: null,
      rejectionReason: null,
      variants: [],
      attributes: [],
      serviceDetails: null,
      accountDetails: null,
    };
  }
  async function save(): Promise<ListingDraftRecord | null> {
    if (!editable) return null;
    setState("saving");
    try {
      const saved =
        initialDraft || draft?.id !== "00000000-0000-4000-8000-000000000000"
          ? await listingDraftApiService.update(draft!.id, draft!.version, payload)
          : await listingDraftApiService.create(payload);
      setDraft(saved);
      setState("saved");
      toast.success("Rascunho persistido", {
        description: "Imagens locais e cofre não foram enviados nem salvos.",
      });
      if (!initialDraft) {
        await navigate({ to: "/vendedor/anuncios/$id/editar", params: { id: saved.id } });
      }
      return saved;
    } catch (e) {
      const error = e as { code?: string; message?: string };
      setState(error.code === "LISTING_DRAFT_VERSION_CONFLICT" ? "conflict" : "error");
      toast.error(error.message ?? "Erro ao salvar");
      return null;
    }
  }
  async function submit() {
    if ((draft?.deliveryMode ?? "MANUAL") === "AUTOMATIC") {
      toast.error("Entrega automática indisponível", {
        description: "Somente entrega manual pode ser enviada para análise nesta sprint.",
      });
      return;
    }
    const current =
      state === "dirty" || !draft || draft.id.startsWith("0000") ? await save() : draft;
    if (!current || current.id.startsWith("0000")) return;
    try {
      const res = await listingDraftApiService.submit(current.id, current.version);
      setDraft(res);
      toast.success("Enviado para análise");
      navigate({ to: "/vendedor/anuncios" });
    } catch (e) {
      const error = e as { message?: string };
      toast.error(error.message ?? "Falha ao enviar");
    }
  }
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-muted-foreground">
        A aprovação desta etapa não publica o anúncio no marketplace. Imagens são apenas previews
        locais e não fazem parte do rascunho salvo. Entrega automática e cofre são futuros; não
        digite credenciais reais.
      </div>
      {draft?.status === "REJECTED" && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
          <b>Rejeitado:</b> {draft.rejectionCode} — {draft.rejectionReason}
        </div>
      )}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Etapa {step}/6 · {statusLabel[state]}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={step <= 1}
            onClick={() => {
              setStep((s) => s - 1);
              setState("dirty");
            }}
          >
            Voltar
          </Button>
          <Button
            variant="outline"
            disabled={step >= 6}
            onClick={() => {
              setStep((s) => s + 1);
              setState("dirty");
            }}
          >
            Avançar
          </Button>
        </div>
      </div>
      <fieldset disabled={!editable} className="space-y-4 rounded-2xl border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label>Modelo</Label>
            <Select
              value={draft?.model ?? "NORMAL"}
              onValueChange={(v) => patch({ model: v as ListingDraftRecord["model"] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NORMAL">Normal</SelectItem>
                <SelectItem value="DYNAMIC">Dinâmico</SelectItem>
                <SelectItem value="SERVICE">Serviço</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Categoria</Label>
            <Select
              value={draft?.categoryId ?? ""}
              onValueChange={(id) => {
                const c = categories.find((x) => x.id === id);
                patch({
                  categoryId: id,
                  category: c ? { id: c.id, slug: c.slug, name: c.name } : null,
                  subcategoryId: null,
                  subcategory: null,
                });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Subcategoria</Label>
            <Select
              value={draft?.subcategoryId ?? ""}
              onValueChange={(id) => {
                const s = subs.find((x) => x.id === id);
                patch({
                  subcategoryId: id,
                  subcategory: s?.id ? { id: s.id, slug: s.slug, name: s.name } : null,
                });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Opcional" />
              </SelectTrigger>
              <SelectContent>
                {subs
                  .filter((s) => s.id)
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id!}>
                      {s.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <Label>Tipo</Label>
            <Select
              value={draft?.productType ?? ""}
              onValueChange={(value) => patch({ productType: value as ListingProductType })}
            >
              <SelectTrigger>
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
          <div>
            <Label>Preço</Label>
            <Input
              value={draft?.price ?? ""}
              onChange={(e) => patch({ price: e.target.value })}
              placeholder="349.90"
            />
          </div>
          <div>
            <Label>Estoque</Label>
            <Input
              type="number"
              value={draft?.stock ?? ""}
              onChange={(e) =>
                patch({ stock: e.target.value === "" ? null : Number(e.target.value) })
              }
            />
          </div>
          <div>
            <Label>Entrega</Label>
            <Select
              value={draft?.deliveryMode ?? "MANUAL"}
              onValueChange={(v) =>
                patch({ deliveryMode: v as ListingDraftRecord["deliveryMode"] })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MANUAL">Manual</SelectItem>
                <SelectItem value="AUTOMATIC">Automática — em breve</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Título</Label>
          <Input value={draft?.title ?? ""} onChange={(e) => patch({ title: e.target.value })} />
        </div>
        <div>
          <Label>Descrição</Label>
          <Textarea
            value={draft?.description ?? ""}
            onChange={(e) => patch({ description: e.target.value })}
          />
        </div>
        <div>
          <Label>Mensagem automática demonstrativa</Label>
          <Textarea
            value={draft?.autoMessage ?? ""}
            onChange={(e) => patch({ autoMessage: e.target.value })}
            placeholder="Persistida apenas como preferência; não envia mensagens."
          />
        </div>
        <div className="space-y-2">
          <Label>Atributos da taxonomia</Label>
          {attrs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum atributo ativo para a seleção atual.
            </p>
          ) : (
            attrs.map((a) => (
              <Input
                key={a.key}
                placeholder={`${a.label}${a.required ? " *" : ""}`}
                value={draft?.attributes.find((x) => x.key === a.key)?.value ?? ""}
                onChange={(e) =>
                  patch({
                    attributes: [
                      ...(draft?.attributes.filter((x) => x.key !== a.key) ?? []),
                      { key: a.key, value: e.target.value },
                    ],
                  })
                }
              />
            ))
          )}
        </div>
      </fieldset>
      <div>
        <ImageUploader value={cover} onChange={setCover} maxImages={1} />
        <ImageUploader value={gallery} onChange={setGallery} maxImages={6} />
        <p className="mt-2 text-xs text-muted-foreground">
          Ao recarregar, previews locais aparecem vazios porque nenhum upload/storage foi
          implementado.
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={save} disabled={!editable || state === "saving"}>
          <Save className="mr-2 h-4 w-4" />
          Salvar rascunho
        </Button>
        <Button onClick={submit} disabled={!editable || state === "saving"}>
          <Send className="mr-2 h-4 w-4" />
          Enviar para análise
        </Button>
      </div>
    </div>
  );
}
