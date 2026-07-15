import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/AuthProvider";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface AuthGateProps {
  children: ReactNode;
  title?: string;
  description?: string;
  className?: string;
}

/**
 * AuthGate — proteção visual para rotas privadas enquanto a
 * autenticação usa a API real. Proteção real e autorização pertencem ao backend; este gate apenas
 * bloqueia visualmente o conteúdo e sugere login/cadastro.
 */
export function AuthGate({
  children,
  title = "Entre para acessar sua conta",
  description = "Você precisa estar logado na LIT Buy para acessar esta área. Faça login ou crie sua conta em segundos.",
  className,
}: AuthGateProps) {
  const { isAuthenticated, initializing } = useAuth();

  if (initializing)
    return (
      <div className="container-lit py-12 text-center text-sm text-muted-foreground">
        Carregando sessão segura...
      </div>
    );
  if (isAuthenticated) return <>{children}</>;

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
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground md:text-base">{description}</p>
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
