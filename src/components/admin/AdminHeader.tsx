import { motion } from "motion/react";
import { Download, RefreshCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/AuthContext";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function AdminHeader() {
  const { user } = useAuth();

  const notifyMock = (label: string) => {
    toast(label, {
      description: "Funcionalidade mockada para demonstração — nenhuma alteração real foi feita.",
    });
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl border border-border bg-card p-5 shadow-card md:p-6"
    >
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <div
            className="grid h-12 w-12 shrink-0 place-items-center rounded-xl shadow-elegant"
            style={{ backgroundImage: "var(--gradient-primary)" }}
          >
            <ShieldCheck className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-bold tracking-tight text-foreground md:text-2xl">
                Painel Administrativo
              </h1>
              <Badge variant="secondary" className="gap-1 text-[10px] font-medium">
                Modo demonstração
              </Badge>
              <Badge
                variant="outline"
                className="gap-1 border-warning/40 text-[10px] font-medium text-warning"
              >
                Mock
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Visão geral operacional da LIT Buy — dados fictícios, ações não persistidas.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-3 md:flex">
            <div className="flex flex-col items-end">
              <span className="text-sm font-semibold text-foreground">
                {user?.name ?? "Administrador"}
              </span>
              <Badge variant="outline" className="gap-1 text-[10px]">
                <ShieldCheck className="h-3 w-3 text-success" /> Administrador
              </Badge>
            </div>
            <Avatar className="h-11 w-11 border border-border">
              <AvatarImage src={user?.avatarUrl} alt={user?.name ?? "Admin"} />
              <AvatarFallback
                className="text-xs font-semibold text-primary-foreground"
                style={{ backgroundImage: "var(--gradient-primary)" }}
              >
                {initials(user?.name ?? "AD")}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => notifyMock("Exportar relatório")}>
              <Download className="mr-2 h-4 w-4" /> Exportar
            </Button>
            <Button size="sm" onClick={() => notifyMock("Atualizar dados")}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Atualizar
            </Button>
          </div>
        </div>
      </div>
    </motion.header>
  );
}
