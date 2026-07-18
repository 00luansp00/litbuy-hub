import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { LogIn, Store, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/AuthContext";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function SellerGate({ children, className }: { children: ReactNode; className?: string }) {
  const { isAuthenticated, initializing, hasSellerAccess } = useAuth();
  if (initializing)
    return (
      <div className="container-lit py-12 text-center text-sm text-muted-foreground">
        Carregando sessão segura...
      </div>
    );
  if (isAuthenticated && hasSellerAccess) return <>{children}</>;
  if (!isAuthenticated)
    return (
      <div className={cn("container-lit py-12 md:py-20", className)}>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-card md:p-10"
        >
          <div
            className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl shadow-elegant"
            style={{ backgroundImage: "var(--gradient-primary)" }}
          >
            <Store className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Entre para acessar o painel vendedor
          </h1>
          <p className="mt-3 text-sm text-muted-foreground md:text-base">
            Faça login com uma conta que já possua acesso de vendedor.
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
  return (
    <div className={cn("container-lit py-12 md:py-20", className)}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-card md:p-10"
      >
        <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-muted text-muted-foreground">
          <Store className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          Acesso de vendedor pendente
        </h1>
        <p className="mt-3 text-sm text-muted-foreground md:text-base">
          Sua conta ainda não possui o papel SELLER. O onboarding real de vendedor será implementado
          em uma sprint futura.
        </p>
        <div className="mt-8 flex justify-center">
          <Button asChild variant="outline" size="lg">
            <Link to="/como-vender">Ver como vender</Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
