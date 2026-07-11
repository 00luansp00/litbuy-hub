import { ShieldCheck, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Aviso discreto de segurança e disputa.
 * Alinhado com o modelo de marketplace intermediador.
 */
export function MessageSecurityNotice({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface/60 p-3 text-xs text-muted-foreground",
        className,
      )}
      role="note"
    >
      <div className="flex items-start gap-2">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
        <span>
          Mantenha a conversa dentro da plataforma para sua segurança. A LIT Buy
          só protege compras feitas por aqui.
        </span>
      </div>
      <div className="mt-2 flex items-start gap-2">
        <ScrollText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>
          Mensagens vinculadas ao pedido poderão ser usadas como evidência em
          disputas futuras.
        </span>
      </div>
    </div>
  );
}
