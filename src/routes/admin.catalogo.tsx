import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Pencil, Plus, Star } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminDashboardSection } from "@/components/admin/AdminDashboardSection";
import { AdminRiskBadge } from "@/components/admin/AdminRiskBadge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminAdvancedService } from "@/services/adminAdvancedService";
import type { AdminCategoryRow, AdminSubcategoryRow } from "@/types";

export const Route = createFileRoute("/admin/catalogo")({
  component: AdminCatalogoPage,
});

function AdminCatalogoPage() {
  const [cats, setCats] = useState<AdminCategoryRow[]>([]);
  const [subs, setSubs] = useState<AdminSubcategoryRow[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    adminAdvancedService.getCategories().then(setCats);
    adminAdvancedService.getSubcategories().then(setSubs);
  }, []);

  const toggle = (id: string, kind: "cat" | "sub") => {
    if (kind === "cat") {
      setCats((prev) => prev.map((c) => (c.id === id ? { ...c, active: !c.active } : c)));
      toast("Categoria alternada (mock)");
    } else {
      setSubs((prev) => prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s)));
      toast("Subcategoria alternada (mock)");
    }
  };

  const featured = (id: string) => {
    setCats((prev) => prev.map((c) => (c.id === id ? { ...c, featured: !c.featured } : c)));
    toast("Destaque atualizado (mock)");
  };

  const filtered = cats.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <AdminLayout
      title="Catálogo"
      description="Gerencie categorias e subcategorias em modo demonstração."
      actions={
        <Button size="sm" onClick={() => toast("Nova categoria (mock)")}>
          <Plus className="mr-2 h-4 w-4" /> Nova categoria
        </Button>
      }
    >
      <AdminDashboardSection title="Categorias" description="Ativar, destacar e ordenar.">
        <div className="mb-3 flex gap-2">
          <Input placeholder="Buscar categoria..." value={query} onChange={(e) => setQuery(e.target.value)} className="max-w-xs" />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ordem</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Anúncios</TableHead>
                <TableHead>Denúncias</TableHead>
                <TableHead>Risco</TableHead>
                <TableHead>Destaque</TableHead>
                <TableHead>Ativa</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.order}</TableCell>
                  <TableCell>
                    <div className="font-medium text-foreground">{c.name}</div>
                    <div className="text-xs text-muted-foreground">/{c.slug} · {c.icon}</div>
                  </TableCell>
                  <TableCell>{c.listingsCount}</TableCell>
                  <TableCell>{c.reports}</TableCell>
                  <TableCell><AdminRiskBadge risk={c.risk} /></TableCell>
                  <TableCell>
                    <button onClick={() => featured(c.id)} aria-label="Alternar destaque">
                      <Star className={c.featured ? "h-4 w-4 fill-warning text-warning" : "h-4 w-4 text-muted-foreground"} />
                    </button>
                  </TableCell>
                  <TableCell>
                    <Switch checked={c.active} onCheckedChange={() => toggle(c.id, "cat")} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => toast("Editar categoria (mock)")}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </AdminDashboardSection>

      <AdminDashboardSection
        title="Subcategorias"
        description="Vinculadas às categorias acima."
        actions={<Button size="sm" variant="outline" onClick={() => toast("Nova subcategoria (mock)")}><Plus className="mr-2 h-4 w-4" />Nova subcategoria</Button>}
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Anúncios</TableHead>
                <TableHead>Ativa</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subs.map((s) => {
                const parent = cats.find((c) => c.id === s.categoryId);
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">{s.name}</div>
                      <div className="text-xs text-muted-foreground">/{s.slug}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{parent?.name ?? "—"}</Badge>
                    </TableCell>
                    <TableCell>{s.listingsCount}</TableCell>
                    <TableCell>
                      <Switch checked={s.active} onCheckedChange={() => toggle(s.id, "sub")} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => toast("Editar subcategoria (mock)")}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Alterações são apenas visuais. Em produção, categorias devem ser gerenciadas pelo backend com validação de slug e migração de anúncios afetados.
        </p>
      </AdminDashboardSection>
    </AdminLayout>
  );
}
