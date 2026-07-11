import { Megaphone, CalendarClock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { analyticsService } from "@/services/analyticsService";
import type { AffiliateCampaign } from "@/types";

const STATUS_TONE: Record<AffiliateCampaign["status"], string> = {
  active: "border-success/40 text-success",
  upcoming: "border-warning/40 text-warning",
  ended: "border-muted text-muted-foreground",
};

const STATUS_LABEL: Record<AffiliateCampaign["status"], string> = {
  active: "Ativa",
  upcoming: "Em breve",
  ended: "Encerrada",
};

export function AffiliateCampaigns({ campaigns }: { campaigns: AffiliateCampaign[] }) {
  return (
    <section>
      <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-foreground">
        <Megaphone className="h-5 w-5 text-primary" /> Campanhas de afiliados
      </h2>
      <div className="grid gap-3 md:grid-cols-2">
        {campaigns.map((c) => {
          const Icon = c.status === "active" ? CheckCircle2 : CalendarClock;
          return (
            <div key={c.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-foreground">{c.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>
                </div>
                <Badge variant="outline" className={STATUS_TONE[c.status]}>
                  {STATUS_LABEL[c.status]}
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Icon className="h-3 w-3" /> {c.period}
                </span>
                <span className="rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-primary">
                  {c.bonusLabel}
                </span>
              </div>
              <div className="mt-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    analyticsService.track("affiliate_campaign_clicked_mocked", { id: c.id });
                    toast("Campanha demonstrativa", {
                      description: "Execução real dependerá de backend e regras de atribuição.",
                    });
                  }}
                >
                  {c.ctaLabel}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
