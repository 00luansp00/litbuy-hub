import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { LogIn, ShieldAlert, ShieldCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/AuthProvider";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface AdminGateProps {
  children: ReactNode;
  className?: string;
}

/**
 * AdminGate — proteção **puramente visual** para as rotas /admin.
 *
 * IMPORTANTE: isto NÃO é segurança real. O campo `isAdmin` é mockado no
 * cliente e pode ser alterado por qualquer pessoa com acesso ao browser.
 * Permissões reais devem ser resolvidas no backend em uma sprint futura,
 * junto de RBAC, auditoria e verificação de sessão.
 */
export function AdminGate({ children, className }: AdminGateProps) {
  const { isAuthenticated, isAdmin } = useAuth();

  if (isAuthenticated && isAdmin) return <>{children}</>;

  if (!isAuthenticated) {
    return (
      <div className={cn("container-lit py-12 md:py-20", className)}>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-card md:p-10"
        >
          <div
            className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl shadow-elegant"
            style={{ backgroundImage: "var(--gradient-primary)" }}
          >
            <ShieldCheck className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Entre para acessar o painel
          </h1>
          <p className="mt-3 text-sm text-muted-foreground md:text-base">
            O Painel Administrativo é restrito. Faça login com uma conta
            autorizada para continuar.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild size="lg">
              <Link to="/login">
                <LogIn className="h-4 w-4" /> Entrar
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/cadastro">
                <UserPlus className="h-4 w-4" /> Criar conta
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={cn("container-lit py-12 md:py-20", className)}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mx-auto max-w-lg rounded-2xl border border-destructive/30 bg-card p-8 text-center shadow-card md:p-10"
      >
        <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-destructive/15 text-destructive">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          Acesso restrito
        </h1>
        <p className="mt-3 text-sm text-muted-foreground md:text-base">
          Sua conta não tem permissão para acessar o Painel Administrativo.
          Se você acredita que isto é um engano, entre em contato com a
          equipe LIT Buy.
        </p>
        <div className="mt-8 flex justify-center">
          <Button asChild variant="outline" size="lg">
            <Link to="/">Voltar para o marketplace</Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
