import { toast } from "sonner";
import { Copy, Download, Eye, ImageIcon, FileText, IdCard, Link as LinkIcon, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { analyticsService } from "@/services/analyticsService";
import type { AffiliateMaterial, AffiliateMaterialType } from "@/types";

const TYPE_ICON: Record<AffiliateMaterialType, typeof ImageIcon> = {
  banner: ImageIcon,
  text: FileText,
  invite_card: IdCard,
  creator_link: LinkIcon,
  guide: BookOpen,
};

export function AffiliateMaterials({ materials }: { materials: AffiliateMaterial[] }) {
  async function handleCopy(m: AffiliateMaterial) {
    try {
      if (m.copyText && typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(m.copyText);
      }
    } catch {
      /* ignore */
    }
    analyticsService.track("affiliate_material_copied_mocked", { id: m.id });
    toast.success("Material copiado (mock)");
  }

  return (
    <section>
      <h2 className="mb-4 text-xl font-bold text-foreground">Materiais de divulgação</h2>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {materials.map((m) => {
          const Icon = TYPE_ICON[m.type];
          return (
            <div key={m.id} className="flex flex-col rounded-2xl border border-border bg-card p-5">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-3 font-semibold text-foreground">{m.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
              <div className="mt-3 rounded-lg border border-dashed border-border bg-surface/40 p-3 text-xs text-muted-foreground">
                {m.previewLabel}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {m.copyText && (
                  <Button size="sm" variant="outline" onClick={() => handleCopy(m)}>
                    <Copy className="h-3.5 w-3.5" /> Copiar
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => toast("Prévia demonstrativa (mock)")}
                >
                  <Eye className="h-3.5 w-3.5" /> Visualizar
                </Button>
                {(m.type === "banner" || m.type === "guide") && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      toast("Download demonstrativo", {
                        description: "Geração real de arquivos exigirá backend.",
                      })
                    }
                  >
                    <Download className="h-3.5 w-3.5" /> Baixar
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
