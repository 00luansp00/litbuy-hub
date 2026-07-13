import { Badge } from "@/components/ui/badge";
import type { EmailTemplateVariable } from "@/types";

interface Props {
  variables: EmailTemplateVariable[];
}

export function EmailTemplateVariables({ variables }: Props) {
  return (
    <div>
      <p className="mb-2 text-[11px] uppercase text-muted-foreground">Variáveis disponíveis</p>
      <div className="flex flex-wrap gap-2">
        {variables.map((v) => (
          <Badge key={v.key} variant="outline" className="gap-1 font-mono text-[11px]">
            <span>{v.key}</span>
            <span className="text-muted-foreground">— {v.label}</span>
          </Badge>
        ))}
      </div>
    </div>
  );
}
