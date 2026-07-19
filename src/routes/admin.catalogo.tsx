import { FormEvent, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Star } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminDashboardSection } from "@/components/admin/AdminDashboardSection";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CATALOG_ALLOWED_ICON_KEYS,
  catalogService,
  type AdminCatalogAttribute,
  type AdminCatalogCategory,
  type AdminCatalogSubcategory,
  type CatalogEntityStatus,
} from "@/services/catalogService";
import type { ListingAttributeInputType, ListingProductType } from "@/types";

export const Route = createFileRoute("/admin/catalogo")({ component: AdminCatalogoPage });

type MutationSource = "form" | "inline";

type DialogState =
  | { kind: "category"; item?: AdminCatalogCategory }
  | { kind: "subcategory"; item?: AdminCatalogSubcategory }
  | { kind: "attribute"; item?: AdminCatalogAttribute }
  | null;

const statusOptions: CatalogEntityStatus[] = ["ACTIVE", "INACTIVE"];
const inputTypes: ListingAttributeInputType[] = ["text", "number", "select", "boolean"];
const productTypes: ListingProductType[] = [
  "account",
  "virtual_currency",
  "gift_card",
  "key",
  "skin",
  "item",
  "service",
  "subscription",
  "game",
  "software",
  "other",
];

function message(error: Error) {
  return "code" in error ? `${String(error.code)}: ${error.message}` : error.message;
}

function AdminCatalogoPage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [pendingOps, setPendingOps] = useState<Set<string>>(() => new Set());
  const cats = useQuery({
    queryKey: ["admin", "catalog", "categories"],
    queryFn: catalogService.admin.categories,
  });
  const subs = useQuery({
    queryKey: ["admin", "catalog", "subcategories"],
    queryFn: catalogService.admin.subcategories,
  });
  const attrs = useQuery({
    queryKey: ["admin", "catalog", "attributes"],
    queryFn: catalogService.admin.attributes,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "catalog"] });
  const addPending = (key: string) => setPendingOps((current) => new Set([...current, key]));
  const removePending = (key: string) =>
    setPendingOps((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  const opKey = (entity: "category" | "subcategory" | "attribute", id?: string) =>
    `${entity}:${id ?? "create"}`;
  const mutateCategory = (id: string | undefined, body: unknown, source: MutationSource) => {
    const key = opKey("category", id);
    if (pendingOps.has(key)) return;
    addPending(key);
    categoryMutation.mutate({ id, body, key, source });
  };
  const mutateSubcategory = (id: string | undefined, body: unknown, source: MutationSource) => {
    const key = opKey("subcategory", id);
    if (pendingOps.has(key)) return;
    addPending(key);
    subcategoryMutation.mutate({ id, body, key, source });
  };
  const mutateAttribute = (id: string | undefined, body: unknown, source: MutationSource) => {
    const key = opKey("attribute", id);
    if (pendingOps.has(key)) return;
    addPending(key);
    attributeMutation.mutate({ id, body, key, source });
  };
  const done = (label: string, source: MutationSource) => {
    toast.success(label);
    if (source === "form") setDialog(null);
    invalidate();
  };
  const categoryMutation = useMutation({
    mutationFn: ({ id, body }: { id?: string; body: unknown; key: string; source: MutationSource }) =>
      id
        ? catalogService.admin.updateCategory(id, body)
        : catalogService.admin.createCategory(body),
    onSuccess: (_data, variables) =>
      done(variables.id ? "Categoria atualizada" : "Categoria criada", variables.source),
    onError: (e: Error) => toast.error(message(e)),
    onSettled: (_data, _error, variables) => removePending(variables.key),
  });
  const subcategoryMutation = useMutation({
    mutationFn: ({ id, body }: { id?: string; body: unknown; key: string; source: MutationSource }) =>
      id
        ? catalogService.admin.updateSubcategory(id, body)
        : catalogService.admin.createSubcategory(body),
    onSuccess: (_data, variables) =>
      done(variables.id ? "Subcategoria atualizada" : "Subcategoria criada", variables.source),
    onError: (e: Error) => toast.error(message(e)),
    onSettled: (_data, _error, variables) => removePending(variables.key),
  });
  const attributeMutation = useMutation({
    mutationFn: ({ id, body }: { id?: string; body: unknown; key: string; source: MutationSource }) =>
      id
        ? catalogService.admin.updateAttribute(id, body)
        : catalogService.admin.createAttribute(body),
    onSuccess: (_data, variables) => done(variables.id ? "Atributo atualizado" : "Atributo criado", variables.source),
    onError: (e: Error) => toast.error(message(e)),
    onSettled: (_data, _error, variables) => removePending(variables.key),
  });
  const filtered = useMemo(
    () =>
      (cats.data ?? []).filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.slug.includes(query.toLowerCase()),
      ),
    [cats.data, query],
  );
  const isLoading = cats.isLoading || subs.isLoading || attrs.isLoading;
  const isError = cats.isError || subs.isError || attrs.isError;
  const retry = () => {
    void cats.refetch();
    void subs.refetch();
    void attrs.refetch();
  };
  const categoryPending = (id: string) => pendingOps.has(opKey("category", id));
  const subcategoryPending = (id: string) => pendingOps.has(opKey("subcategory", id));
  const attributePending = (id: string) => pendingOps.has(opKey("attribute", id));

  return (
    <AdminLayout
      title="Catálogo"
      description="Gerencie a taxonomia persistente: categorias, subcategorias e atributos reais."
    >
      {isLoading && <p className="text-sm text-muted-foreground">Carregando taxonomia real...</p>}
      {isError && (
        <div className="rounded-lg border border-destructive/40 p-4">
          <p className="text-sm">Falha ao carregar catálogo.</p>
          <Button size="sm" onClick={retry} className="mt-2">
            Tentar novamente
          </Button>
        </div>
      )}
      {!isLoading && !isError && (
        <>
          <AdminDashboardSection
            title="Categorias"
            description="Sem métricas fictícias: somente taxonomia, ordem, destaque e status."
            actions={
              <Button size="sm" onClick={() => setDialog({ kind: "category" })}>
                <Plus className="mr-2 h-4 w-4" /> Nova categoria
              </Button>
            }
          >
            <Input
              placeholder="Buscar categoria..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="mb-3 max-w-xs"
            />
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma categoria encontrada.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ordem</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Destaque</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.sortOrder}</TableCell>
                      <TableCell>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">
                          /{c.slug} · {c.icon}
                        </div>
                      </TableCell>
                      <TableCell>
                        <button
                          disabled={categoryPending(c.id)}
                          onClick={() => mutateCategory(c.id, { featured: !c.featured }, "inline")}
                        >
                          <Star
                            className={
                              c.featured
                                ? "h-4 w-4 fill-warning text-warning"
                                : "h-4 w-4 text-muted-foreground"
                            }
                          />
                        </button>
                      </TableCell>
                      <TableCell>
                        <Badge variant={c.status === "ACTIVE" ? "default" : "secondary"}>
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDialog({ kind: "category", item: c })}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Switch
                          disabled={categoryPending(c.id)}
                          checked={c.status === "ACTIVE"}
                          onCheckedChange={() => {
                            if (
                              c.status === "ACTIVE" &&
                              !confirm(`Inativar ${c.name}? Ela desaparecerá do catálogo público.`)
                            )
                              return;
                            mutateCategory(
                              c.id,
                              { status: c.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" },
                              "inline",
                            );
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </AdminDashboardSection>

          <AdminDashboardSection
            title="Subcategorias"
            description="Movimentação entre categorias é temporária e será restringida quando anúncios reais existirem."
            actions={
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDialog({ kind: "subcategory" })}
              >
                <Plus className="mr-2 h-4 w-4" />
                Nova subcategoria
              </Button>
            }
          >
            {(subs.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma subcategoria.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(subs.data ?? []).map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="font-medium">{s.name}</div>
                        <div className="text-xs text-muted-foreground">/{s.slug}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {(cats.data ?? []).find((c) => c.id === s.categoryId)?.name ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>{s.status}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDialog({ kind: "subcategory", item: s })}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Switch
                          disabled={subcategoryPending(s.id)}
                          checked={s.status === "ACTIVE"}
                          onCheckedChange={() => {
                            if (s.status === "ACTIVE" && !confirm(`Inativar ${s.name}?`)) return;
                            mutateSubcategory(
                              s.id,
                              { status: s.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" },
                              "inline",
                            );
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </AdminDashboardSection>

          <AdminDashboardSection
            title="Atributos"
            description="Configure atributos por subcategoria ou tipo de produto. Chaves editáveis são risco temporário documentado antes de anúncios reais."
            actions={
              <Button size="sm" variant="outline" onClick={() => setDialog({ kind: "attribute" })}>
                <Plus className="mr-2 h-4 w-4" />
                Novo atributo
              </Button>
            }
          >
            {(attrs.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum atributo.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead>Escopo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(attrs.data ?? []).map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="font-medium">{a.label}</div>
                        <div className="text-xs text-muted-foreground">{a.key}</div>
                      </TableCell>
                      <TableCell>
                        {a.subcategoryId
                          ? (subs.data ?? []).find((s) => s.id === a.subcategoryId)?.name
                          : a.productType}
                      </TableCell>
                      <TableCell>{a.inputType}</TableCell>
                      <TableCell>{a.status}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDialog({ kind: "attribute", item: a })}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Switch
                          disabled={attributePending(a.id)}
                          checked={a.status === "ACTIVE"}
                          onCheckedChange={() =>
                            mutateAttribute(
                              a.id,
                              { status: a.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" },
                              "inline",
                            )
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </AdminDashboardSection>
        </>
      )}
      <CatalogDialog
        dialog={dialog}
        categories={cats.data ?? []}
        subcategories={subs.data ?? []}
        onClose={() => setDialog(null)}
        onCategory={(id, body) => mutateCategory(id, body, "form")}
        onSubcategory={(id, body) => mutateSubcategory(id, body, "form")}
        onAttribute={(id, body) => mutateAttribute(id, body, "form")}
        pending={dialog ? pendingOps.has(opKey(dialog.kind, dialog.item?.id)) : false}
      />
    </AdminLayout>
  );
}

function CatalogDialog({
  dialog,
  categories,
  subcategories,
  onClose,
  onCategory,
  onSubcategory,
  onAttribute,
  pending,
}: {
  dialog: DialogState;
  categories: AdminCatalogCategory[];
  subcategories: AdminCatalogSubcategory[];
  onClose: () => void;
  onCategory: (id: string | undefined, body: unknown) => void;
  onSubcategory: (id: string | undefined, body: unknown) => void;
  onAttribute: (id: string | undefined, body: unknown) => void;
  pending: boolean;
}) {
  if (!dialog) return null;
  const title =
    dialog.kind === "category"
      ? `${dialog.item ? "Editar" : "Nova"} categoria`
      : dialog.kind === "subcategory"
        ? `${dialog.item ? "Editar" : "Nova"} subcategoria`
        : `${dialog.item ? "Editar" : "Novo"} atributo`;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {dialog.kind === "category" ? (
          <CategoryForm item={dialog.item} pending={pending} onSubmit={onCategory} />
        ) : dialog.kind === "subcategory" ? (
          <SubcategoryForm
            item={dialog.item}
            categories={categories}
            pending={pending}
            onSubmit={onSubcategory}
          />
        ) : (
          <AttributeForm
            item={dialog.item}
            subcategories={subcategories}
            pending={pending}
            onSubmit={onAttribute}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function field(form: HTMLFormElement, name: string) {
  return (new FormData(form).get(name)?.toString() ?? "").trim();
}
function status(form: HTMLFormElement) {
  return field(form, "status") as CatalogEntityStatus;
}

function CategoryForm({
  item,
  pending,
  onSubmit,
}: {
  item?: AdminCatalogCategory;
  pending: boolean;
  onSubmit: (id: string | undefined, body: unknown) => void;
}) {
  return (
    <form
      className="space-y-3"
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const f = e.currentTarget;
        onSubmit(item?.id, {
          name: field(f, "name"),
          slug: field(f, "slug"),
          description: field(f, "description") || null,
          iconKey: field(f, "iconKey") || null,
          colorHex: field(f, "colorHex") || null,
          sortOrder: Number(field(f, "sortOrder") || 0),
          featured: new FormData(f).get("featured") === "on",
          status: status(f),
        });
      }}
    >
      <L name="name" label="Nome" defaultValue={item?.name} />
      <L name="slug" label="Slug" defaultValue={item?.slug} />
      <Label>Descrição</Label>
      <Textarea name="description" defaultValue={item?.description ?? ""} />
      <Label>Ícone</Label>
      <select
        name="iconKey"
        defaultValue={item?.iconKey ?? "LayoutGrid"}
        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
      >
        {CATALOG_ALLOWED_ICON_KEYS.map((i) => (
          <option key={i}>{i}</option>
        ))}
      </select>
      <L name="colorHex" label="Cor" defaultValue={item?.colorHex ?? "#64748B"} />
      <L name="sortOrder" label="Ordem" type="number" defaultValue={String(item?.sortOrder ?? 0)} />
      <Label>Status</Label>
      <select
        name="status"
        defaultValue={item?.status ?? "ACTIVE"}
        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
      >
        {statusOptions.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      <label className="flex gap-2 text-sm">
        <input name="featured" type="checkbox" defaultChecked={item?.featured ?? false} />
        Destaque
      </label>
      <Button disabled={pending} type="submit">
        Salvar
      </Button>
    </form>
  );
}
function SubcategoryForm({
  item,
  categories,
  pending,
  onSubmit,
}: {
  item?: AdminCatalogSubcategory;
  categories: AdminCatalogCategory[];
  pending: boolean;
  onSubmit: (id: string | undefined, body: unknown) => void;
}) {
  return (
    <form
      className="space-y-3"
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const f = e.currentTarget;
        onSubmit(item?.id, {
          categoryId: field(f, "categoryId"),
          name: field(f, "name"),
          slug: field(f, "slug"),
          sortOrder: Number(field(f, "sortOrder") || 0),
          status: status(f),
        });
      }}
    >
      <Label>Categoria</Label>
      <select
        required
        name="categoryId"
        defaultValue={item?.categoryId ?? categories[0]?.id ?? ""}
        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
      >
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <L name="name" label="Nome" defaultValue={item?.name} />
      <L name="slug" label="Slug" defaultValue={item?.slug} />
      <L name="sortOrder" label="Ordem" type="number" defaultValue={String(item?.sortOrder ?? 0)} />
      <Label>Status</Label>
      <select
        name="status"
        defaultValue={item?.status ?? "ACTIVE"}
        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
      >
        {statusOptions.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      <Button disabled={pending} type="submit">
        Salvar
      </Button>
    </form>
  );
}
function AttributeForm({
  item,
  subcategories,
  pending,
  onSubmit,
}: {
  item?: AdminCatalogAttribute;
  subcategories: AdminCatalogSubcategory[];
  pending: boolean;
  onSubmit: (id: string | undefined, body: unknown) => void;
}) {
  const [scope, setScope] = useState(item?.subcategoryId ? "subcategory" : "productType");
  const [inputType, setInputType] = useState<ListingAttributeInputType>(item?.type ?? "text");
  return (
    <form
      className="space-y-3"
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const f = e.currentTarget;
        const options = field(f, "options")
          .split("\n")
          .map((o) => o.trim())
          .filter(Boolean);
        onSubmit(item?.id, {
          subcategoryId: scope === "subcategory" ? field(f, "subcategoryId") : null,
          productType: scope === "productType" ? field(f, "productType") : null,
          key: field(f, "key"),
          label: field(f, "label"),
          inputType,
          placeholder: field(f, "placeholder") || null,
          required: new FormData(f).get("required") === "on",
          selectOptions: inputType === "select" ? options : [],
          sortOrder: Number(field(f, "sortOrder") || 0),
          status: status(f),
        });
      }}
    >
      <Label>Escopo</Label>
      <select
        value={scope}
        onChange={(e) => setScope(e.target.value)}
        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
      >
        <option value="subcategory">Subcategoria</option>
        <option value="productType">Tipo de produto</option>
      </select>
      {scope === "subcategory" ? (
        <>
          <Label>Subcategoria</Label>
          <select
            name="subcategoryId"
            defaultValue={item?.subcategoryId ?? subcategories[0]?.id ?? ""}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            {subcategories.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </>
      ) : (
        <>
          <Label>Tipo de produto</Label>
          <select
            name="productType"
            defaultValue={item?.productType ?? "virtual_currency"}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            {productTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </>
      )}
      <L name="key" label="Key" defaultValue={item?.key} />
      <L name="label" label="Label" defaultValue={item?.label} />
      <Label>Input type</Label>
      <select
        value={inputType}
        onChange={(e) => setInputType(e.target.value as ListingAttributeInputType)}
        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
      >
        {inputTypes.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <L name="placeholder" label="Placeholder" defaultValue={item?.placeholder} />
      {inputType === "select" && (
        <>
          <Label>Opções (uma por linha)</Label>
          <Textarea name="options" required defaultValue={(item?.options ?? []).join("\n")} />
        </>
      )}
      <L name="sortOrder" label="Ordem" type="number" defaultValue={String(item?.sortOrder ?? 0)} />
      <Label>Status</Label>
      <select
        name="status"
        defaultValue={item?.status ?? "ACTIVE"}
        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
      >
        {statusOptions.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      <label className="flex gap-2 text-sm">
        <input name="required" type="checkbox" defaultChecked={item?.required ?? false} />
        Obrigatório
      </label>
      <Button disabled={pending} type="submit">
        Salvar
      </Button>
    </form>
  );
}
function L({
  name,
  label,
  defaultValue,
  type = "text",
}: {
  name: string;
  label: string;
  defaultValue?: string;
  type?: string;
}) {
  return (
    <>
      <Label>{label}</Label>
      <Input
        required={name === "name" || name === "slug" || name === "key" || name === "label"}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
      />
    </>
  );
}
