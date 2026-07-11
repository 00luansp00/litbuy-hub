import { Bell } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { ListingNotificationPreferences } from "@/types";

interface Props {
  value: ListingNotificationPreferences;
  onChange: (v: ListingNotificationPreferences) => void;
}

const ITEMS: {
  key: keyof ListingNotificationPreferences;
  label: string;
  hint: string;
  future?: boolean;
}[] = [
  { key: "inApp", label: "Notificação dentro da plataforma", hint: "Central de notificações da LIT Buy." },
  { key: "browser", label: "Notificação no navegador", hint: "Push nativo do browser (mockado)." },
  { key: "emailFuture", label: "E-mail", hint: "Disponível em breve.", future: true },
  {
    key: "externalIntegrationFuture",
    label: "Integração externa",
    hint: "Webhook para automações externas — futuro.",
    future: true,
  },
];

export function NotificationsPrefs({ value, onChange }: Props) {
  const patch = (k: keyof ListingNotificationPreferences, v: boolean) =>
    onChange({ ...value, [k]: v });
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Bell className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold text-foreground">
          Notificações de venda
        </h4>
      </div>
      <div className="space-y-2">
        {ITEMS.map((it) => (
          <div
            key={it.key}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface/40 p-3"
          >
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                {it.label}
                {it.future && (
                  <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                    em breve
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">{it.hint}</div>
            </div>
            <Switch
              checked={!!value[it.key]}
              onCheckedChange={(v) => patch(it.key, v)}
              disabled={it.future}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
