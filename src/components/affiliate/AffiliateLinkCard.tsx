import { Copy, QrCode, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { affiliateService } from "@/services/affiliateService";
import { analyticsService } from "@/services/analyticsService";
import type { AffiliateLink } from "@/types";

export function AffiliateLinkCard({ link }: { link: AffiliateLink }) {
  async function handleCopy(value: string, label: string) {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(value);
      }
    } catch {
      /* ignore — mock */
    }
    await affiliateService.simulateCopyAffiliateLink();
    analyticsService.track("affiliate_link_copied_mocked", { label });
    toast.success("Link copiado (mock)", { description: value });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Meu link de afiliado</h3>
          <p className="text-xs text-muted-foreground">
            Compartilhe seu link único. Tracking real exigirá backend.
          </p>
        </div>
        <div className="hidden md:grid h-14 w-14 place-items-center rounded-lg border border-dashed border-border bg-surface text-muted-foreground">
          <QrCode className="h-6 w-6" />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface/50 p-2">
          <span className="truncate text-sm text-foreground">{link.url}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleCopy(link.url, "long")}
            className="ml-auto"
          >
            <Copy className="h-3.5 w-3.5" /> Copiar
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-lg border border-border bg-surface/50 px-3 py-1.5 text-xs text-muted-foreground">
            Código: <span className="font-semibold text-foreground">{link.code}</span>
          </div>
          <div className="rounded-lg border border-border bg-surface/50 px-3 py-1.5 text-xs text-muted-foreground">
            Curto: <span className="font-semibold text-foreground">{link.shortUrl}</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              analyticsService.track("affiliate_link_copied_mocked", { label: "share" });
              toast("Compartilhamento demonstrativo", {
                description: "Em produção real, abriremos as opções nativas de compartilhamento.",
              });
            }}
          >
            <Share2 className="h-3.5 w-3.5" /> Compartilhar
          </Button>
        </div>
      </div>
    </div>
  );
}
