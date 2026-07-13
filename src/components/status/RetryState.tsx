import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RetryStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  onBack?: () => void;
  className?: string;
}

/**
 * RetryState — estado de falha reutilizável (Sprint 18.20).
 * Usado quando um service mockado falha visualmente.
 */
export function RetryState({
  title = "Não foi possível carregar",
  description = "Tente novamente em alguns instantes.",
  onRetry,
  onBack,
  className,
}: RetryStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center",
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/15 text-warning">
        <AlertTriangle className="h-5 w-5" aria-hidden />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {onRetry && (
          <Button onClick={onRetry} size="sm">
            <RotateCw className="mr-2 h-4 w-4" /> Tentar novamente
          </Button>
        )}
        {onBack && (
          <Button variant="outline" size="sm" onClick={onBack}>
            Voltar
          </Button>
        )}
      </div>
    </div>
  );
}
