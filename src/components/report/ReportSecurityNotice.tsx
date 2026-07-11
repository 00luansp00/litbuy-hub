import { ShieldAlert } from "lucide-react";

export function ReportSecurityNotice() {
  return (
    <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
      <div className="mb-1 flex items-center gap-1.5 font-medium">
        <ShieldAlert className="h-3.5 w-3.5" /> Aviso de segurança
      </div>
      <ul className="ml-4 list-disc space-y-0.5 text-warning/90">
        <li>Mantenha toda a negociação dentro da LIT Buy.</li>
        <li>
          Não compartilhe WhatsApp, Discord, Telegram, telefone ou e-mail.
        </li>
        <li>Denúncias falsas podem gerar penalidades em produção.</li>
        <li>
          Evidências podem ser usadas pela equipe da LIT Buy para análise.
        </li>
      </ul>
    </div>
  );
}
