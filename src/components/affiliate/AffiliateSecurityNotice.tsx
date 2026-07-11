import { ShieldAlert } from "lucide-react";

export function AffiliateSecurityNotice() {
  return (
    <aside className="rounded-2xl border border-warning/40 bg-warning/5 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-warning">
        <ShieldAlert className="h-4 w-4" /> Segurança e antifraude
      </div>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
        <li>Autoindicação e uso de múltiplas contas são proibidos.</li>
        <li>Spam, cliques automatizados e tráfego incentivado fraudulento podem suspender o afiliado.</li>
        <li>Comissões podem ser canceladas em caso de disputa, estorno ou fraude.</li>
        <li>
          Comissão real exigirá tracking seguro, atribuição confiável, antifraude
          e auditoria — nada disso existe no MVP.
        </li>
      </ul>
    </aside>
  );
}
