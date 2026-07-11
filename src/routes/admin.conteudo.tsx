import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Eye, History, Pencil, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminDashboardSection } from "@/components/admin/AdminDashboardSection";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminAdvancedService } from "@/services/adminAdvancedService";
import type { AdminContentPage } from "@/types";

export const Route = createFileRoute("/admin/conteudo")({
  component: AdminContentPageRoute,
});

const KIND_LABEL: Record<AdminContentPage["kind"], string> = {
  page: "Página",
  banner: "Banner",
  faq: "FAQ",
  policy: "Política",
  campaign: "Campanha",
};

function AdminContentPageRoute() {
  const [pages, setPages] = useState<AdminContentPage[]>([]);
  useEffect(() => {
    adminAdvancedService.getContentPages().then(setPages);
  }, []);

  const togglePublish = (id: string) => {
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, status: p.status === "published" ? "draft" : "published" } : p)));
    toast("Publicação alternada (mock)");
  };

  return (
    <AdminLayout
      title="Conteúdo institucional"
      description="Banners, FAQs, políticas e campanhas — CMS visual/mockado."
      actions={<Button size="sm" onClick={() => toast("Nova página (mock)")}><Plus className="mr-2 h-4 w-4" />Nova página</Button>}
    >
      <AdminDashboardSection title="Páginas e blocos">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Versão</TableHead>
                <TableHead>Atualizado</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pages.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{p.title}</div>
                    <div className="text-xs text-muted-foreground">/{p.slug}</div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{KIND_LABEL[p.kind]}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">v{p.version}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(p.updatedAt), { locale: ptBR, addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.status === "published" ? "default" : "outline"}>{p.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="ghost" onClick={() => toast("Visualizar (mock)")}><Eye className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => toast("Editar conteúdo (mock)")}><Pencil className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => toast("Voltar versão (mock)")}><History className="h-3 w-3" /></Button>
                    <Button size="sm" variant="outline" onClick={() => togglePublish(p.id)}>
                      {p.status === "published" ? "Despublicar" : "Publicar"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          CMS real deve viver no backend com controle de versão, agendamento e permissões separadas.
        </p>
      </AdminDashboardSection>
    </AdminLayout>
  );
}
