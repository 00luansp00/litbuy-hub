import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { analyticsService } from "@/services/analyticsService";
import { transactionalEmailService } from "@/services/transactionalEmailService";
import type {
  CommunicationChannel,
  CommunicationPreference,
  TransactionalEmailCategory,
} from "@/types";

const CATEGORY_LABEL: Record<TransactionalEmailCategory, string> = {
  auth: "Autenticação",
  security: "Segurança",
  order: "Pedidos",
  payment: "Pagamentos",
  delivery: "Entregas",
  message: "Mensagens",
  mediation: "Mediações",
  report: "Denúncias",
  kyc: "Verificação KYC",
  seller: "Vendedor",
  affiliate: "Afiliados",
  admin: "Admin",
  marketing: "Marketing / promos",
};

const CHANNELS: { key: CommunicationChannel; label: string; future?: boolean }[] = [
  { key: "platform", label: "Plataforma" },
  { key: "email", label: "E-mail" },
  { key: "browser_future", label: "Navegador", future: true },
  { key: "sms_future", label: "SMS", future: true },
];

interface Props {
  initial: CommunicationPreference[];
}

export function CommunicationPreferencesPanel({ initial }: Props) {
  const [prefs, setPrefs] = useState<CommunicationPreference[]>(initial);

  const grouped = useMemo(() => {
    const map = new Map<TransactionalEmailCategory, CommunicationPreference[]>();
    for (const p of prefs) {
      const arr = map.get(p.category) ?? [];
      arr.push(p);
      map.set(p.category, arr);
    }
    return Array.from(map.entries());
  }, [prefs]);

  const toggle = async (eventKey: string, channel: CommunicationChannel, enabled: boolean) => {
    const target = prefs.find((p) => p.eventKey === eventKey);
    if (target?.critical && channel === "email" && !enabled) {
      toast.error("E-mails críticos de segurança não podem ser desativados.");
      return;
    }
    setPrefs((prev) =>
      prev.map((p) =>
        p.eventKey === eventKey
          ? { ...p, channels: { ...p.channels, [channel]: enabled } }
          : p,
      ),
    );
    analyticsService.track("communication_preferences_updated_mocked", { eventKey, channel, enabled });
    await transactionalEmailService.simulateUpdateCommunicationPreferences({ eventKey, channel, enabled });
    toast.success("Preferência atualizada (mock).");
  };

  return (
    <div className="space-y-6">
      {grouped.map(([cat, items]) => (
        <section key={cat} className="space-y-2">
          <header className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{CATEGORY_LABEL[cat]}</h3>
            <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
          </header>
          <div className="overflow-hidden rounded-2xl border border-border bg-surface/40">
            {items.map((p, i) => (
              <div
                key={p.eventKey}
                className={
                  "flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between" +
                  (i > 0 ? " border-t border-border" : "")
                }
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{p.label}</p>
                    {p.critical && (
                      <Badge variant="destructive" className="gap-1 text-[10px]">
                        <Lock className="h-3 w-3" /> crítico
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{p.description}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {CHANNELS.map((c) => {
                    const enabled = !!p.channels[c.key];
                    const forcedOn = p.critical && c.key === "email";
                    return (
                      <label
                        key={c.key}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background/60 px-2 py-1.5 text-[11px]"
                      >
                        <span className="text-muted-foreground">
                          {c.label}
                          {c.future && (
                            <span className="ml-1 rounded-full border border-border px-1 text-[9px] uppercase">
                              em breve
                            </span>
                          )}
                        </span>
                        <Switch
                          checked={enabled}
                          onCheckedChange={(v) => toggle(p.eventKey, c.key, v)}
                          disabled={c.future || forcedOn}
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
      <p className="text-[11px] text-muted-foreground">
        Preferências reais serão persistidas no backend futuramente. Nada é salvo no frontend.
      </p>
    </div>
  );
}
