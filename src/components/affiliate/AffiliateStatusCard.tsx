import { ShieldCheck, Clock, ShieldAlert, PowerOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AffiliateProfile, AffiliateStatus } from "@/types";

const STATUS_MAP: Record<
  AffiliateStatus,
  { label: string; tone: string; icon: typeof ShieldCheck; hint: string }
> = {
  active: {
    label: "Ativo",
    tone: "text-success",
    icon: ShieldCheck,
    hint: "Sua conta de afiliado está ativa (mock).",
  },
  pending_review: {
    label: "Em análise",
    tone: "text-warning",
    icon: Clock,
    hint: "Sua conta está em análise (mock). Aguarde a revisão.",
  },
  suspended: {
    label: "Suspenso",
    tone: "text-destructive",
    icon: ShieldAlert,
    hint: "Sua conta foi suspensa por possível violação das regras.",
  },
  inactive: {
    label: "Inativo",
    tone: "text-muted-foreground",
    icon: PowerOff,
    hint: "Ative o programa para começar a gerar comissão demonstrativa.",
  },
};

export function AffiliateStatusCard({ profile }: { profile: AffiliateProfile }) {
  const s = STATUS_MAP[profile.status];
  const Icon = s.icon;
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase text-muted-foreground">Status do afiliado</div>
          <div className={`mt-1 flex items-center gap-2 text-lg font-semibold ${s.tone}`}>
            <Icon className="h-5 w-5" /> {s.label}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>
        </div>
        <Badge variant="outline" className="capitalize">
          Tier {profile.tier}
        </Badge>
      </div>
      {profile.status === "suspended" && profile.suspensionReason && (
        <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
          Motivo: {profile.suspensionReason}
        </p>
      )}
    </div>
  );
}
