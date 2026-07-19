import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Star } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminDashboardSection } from "@/components/admin/AdminDashboardSection";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  catalogService,
  type AdminCatalogCategory,
  type AdminCatalogSubcategory,
} from "@/services/catalogService";

export const Route = createFileRoute("/admin/catalogo")({ component: AdminCatalogoPage });

function AdminCatalogoPage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
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
  const updateCategory = useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) =>
      catalogService.admin.updateCategory(id, body),
    onSuccess: () => {
      toast.success("Categoria atualizada");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setPendingId(null),
  });
  const updateSubcategory = useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) =>
      catalogService.admin.updateSubcategory(id, body),
    onSuccess: () => {
      toast.success("Subcategoria atualizada");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setPendingId(null),
  });
  const createCategory = useMutation({
    mutationFn: () =>
      catalogService.admin.createCategory({
        slug: `nova-categoria-${Date.now()}`,
        name: "Nova categoria",
        iconKey: "LayoutGrid",
        colorHex: "#64748B",
        sortOrder: 100,
      }),
    onSuccess: () => {
      toast.success("Categoria criada");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const createSubcategory = useMutation({
    mutationFn: (categoryId: string) =>
      catalogService.admin.createSubcategory({
        categoryId,
        slug: `nova-subcategoria-${Date.now()}`,
        name: "Nova subcategoria",
        sortOrder: 100,
      }),
    onSuccess: () => {
      toast.success("Subcategoria criada");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
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
  const toggleCategory = (c: AdminCatalogCategory, body: unknown, confirmInactive = false) => {
    if (confirmInactive && !confirm(`Inativar ${c.name}? Ela desaparecerá do catálogo público.`))
      return;
    setPendingId(c.id);
    updateCategory.mutate({ id: c.id, body });
  };
  const toggleSubcategory = (s: AdminCatalogSubcategory) => {
    if (s.status === "ACTIVE" && !confirm(`Inativar ${s.name}?`)) return;
    setPendingId(s.id);
    updateSubcategory.mutate({
      id: s.id,
      body: { status: s.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" },
    });
  };
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
              <Button
                size="sm"
                onClick={() => createCategory.mutate()}
                disabled={createCategory.isPending}
              >
                <Plus className="mr-2 h-4 w-4" />
                Nova categoria
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
                          disabled={pendingId === c.id}
                          onClick={() => toggleCategory(c, { featured: !c.featured })}
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
                      <TableCell className="text-right">
                        <Switch
                          disabled={pendingId === c.id}
                          checked={c.status === "ACTIVE"}
                          onCheckedChange={() =>
                            toggleCategory(
                              c,
                              { status: c.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" },
                              c.status === "ACTIVE",
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
          <AdminDashboardSection
            title="Subcategorias"
            description="Movimentação entre categorias é temporária e será restringida quando anúncios reais existirem."
            actions={
              <Button
                size="sm"
                variant="outline"
                disabled={!cats.data?.[0]}
                onClick={() => cats.data?.[0] && createSubcategory.mutate(cats.data[0].id)}
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
                    <TableHead>Ações</TableHead>
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
                      <TableCell>
                        <Switch
                          disabled={pendingId === s.id}
                          checked={s.status === "ACTIVE"}
                          onCheckedChange={() => toggleSubcategory(s)}
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
            description="Chaves podem ser editadas nesta sprint, mas isso é risco temporário documentado antes de anúncios reais."
          >
            <p className="text-sm text-muted-foreground">
              {attrs.data?.length ?? 0} atributo(s) configurável(is) reais carregados.
            </p>
          </AdminDashboardSection>
        </>
      )}
    </AdminLayout>
  );
}
