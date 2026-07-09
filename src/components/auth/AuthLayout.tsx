import { motion } from "motion/react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Logo } from "@/components/common/Logo";
import { AuthCard } from "./AuthCard";
import { AuthHeader } from "./AuthHeader";
import { FormFooter } from "./FormFooter";

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  eyebrow?: string;
}

export function AuthLayout({ title, subtitle, children, footer, eyebrow }: AuthLayoutProps) {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-hero flex items-center justify-center px-4 py-12 md:py-20 overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(600px 300px at 20% 10%, color-mix(in oklab, var(--primary) 20%, transparent), transparent 60%), radial-gradient(500px 260px at 80% 90%, color-mix(in oklab, var(--accent) 18%, transparent), transparent 60%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative w-full max-w-md"
      >
        <div className="mb-6 flex justify-center">
          <Link to="/" aria-label="Ir para a home">
            <Logo />
          </Link>
        </div>

        <AuthCard>
          <AuthHeader title={title} subtitle={subtitle} eyebrow={eyebrow} />
          <div className="mt-6">{children}</div>
          {footer ? <FormFooter>{footer}</FormFooter> : null}
        </AuthCard>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Ao continuar você concorda com os{" "}
          <Link to="/" className="underline underline-offset-2 hover:text-foreground">
            Termos de uso
          </Link>{" "}
          e a{" "}
          <Link to="/" className="underline underline-offset-2 hover:text-foreground">
            Política de privacidade
          </Link>
          .
        </p>
      </motion.div>
    </div>
  );
}
