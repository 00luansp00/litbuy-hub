import { BadgeCheck, Clock, ShieldAlert, ShieldQuestion, ShieldX, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VerificationStatus } from "@/types";

interface Props {
  status: VerificationStatus;
  compact?: boolean;
  className?: string;
}

const META: Record<
  VerificationStatus,
  { label: string; description: string; icon: typeof BadgeCheck; tone: string; cta: string }
> = {
  not_started: {
    label: "Não iniciada",
    description: "Verifique sua identidade para aumentar limites e ganhar o selo Vendedor Verificado.",
    icon: ShieldQuestion,
    tone: "text-muted-foreground bg-surface",
    cta: "Verificar agora",
  },
  in_progress: {
    label: "Em andamento",
    description: "Continue de onde parou para concluir sua verificação.",
    icon: Sparkles,
    tone: "text-primary bg-primary/10",
    cta: "Continuar verificação",
  },
  pending_review: {
    label: "Em análise",
    description: "Recebemos seus dados. Análise leva até 48h úteis (mock).",
    icon: Clock,
    tone: "text-warning bg-warning/10",
    cta: "Ver status",
  },
  approved: {
    label: "Aprovada",
    description: "Sua identidade está verificada. Você exibe o selo Vendedor Verificado.",
    icon: BadgeCheck,
    tone: "text-success bg-success/10",
    cta: "Ver detalhes",
  },
  rejected: {
    label: "Recusada",
    description: "Não foi possível concluir a verificação. Envie novamente.",
    icon: ShieldX,
    tone: "text-destructive bg-destructive/10",
    cta: "Refazer",
  },
  needs_more_info: {
    label: "Precisa de informações",
    description: "Solicitamos ajustes. Complete os itens indicados.",
    icon: ShieldAlert,
    tone: "text-warning bg-warning/10",
    cta: "Completar",
  },
};

export function VerificationStatusCard({ status, compact, className }: Props) {
  const m = META[status];
  const Icon = m.icon;
  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card p-5 shadow-card",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", m.tone)}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">Verificação de identidade</h3>
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", m.tone)}>
              {m.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
          {!compact && (
            <Button asChild size="sm" className="mt-3">
              <Link to="/perfil/verificacao">{m.cta}</Link>
            </Button>
          )}
        </div>
        {compact && (
          <Button asChild size="sm" variant="outline">
            <Link to="/perfil/verificacao">{m.cta}</Link>
          </Button>
        )}
      </div>
    </section>
  );
}
