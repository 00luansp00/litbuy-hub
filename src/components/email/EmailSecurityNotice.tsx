import { ShieldAlert } from "lucide-react";

interface Props {
  compact?: boolean;
}

/**
 * Aviso visual de segurança de e-mails transacionais (Sprint 18.19).
 * Nada é enviado de fato — 100% mockado.
 */
export function EmailSecurityNotice({ compact }: Props) {
  return (
    <aside
      className="rounded-2xl border border-warning/30 bg-warning/5 p-4 text-xs text-warning-foreground/90"
      role="note"
    >
      <div className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Segurança de e-mails</p>
          {!compact && (
            <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
              <li>A LIT Buy nunca pede sua senha por e-mail.</li>
              <li>Verifique se links vêm do domínio oficial <span className="font-mono">litbuy.com</span>.</li>
              <li>Códigos e links expiram em minutos.</li>
              <li>Novos dispositivos sempre geram alerta.</li>
            </ul>
          )}
          <p className="text-[11px] text-muted-foreground">
            Modo demonstração: nenhum e-mail real é enviado no frontend.
          </p>
        </div>
      </div>
    </aside>
  );
}
