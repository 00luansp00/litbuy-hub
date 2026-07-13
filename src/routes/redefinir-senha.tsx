import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { PasswordResetMockForm } from "@/components/email/PasswordResetMockForm";
import { EmailSecurityNotice } from "@/components/email/EmailSecurityNotice";

export const Route = createFileRoute("/redefinir-senha")({
  component: RedefinirSenhaPage,
  head: () => ({
    meta: [
      { title: "Redefinir senha — LIT Buy" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Defina uma nova senha para sua conta LIT Buy (modo demonstração)." },
    ],
  }),
});

function RedefinirSenhaPage() {
  return (
    <AuthLayout
      eyebrow="Segurança"
      title="Redefinir senha"
      subtitle="Escolha uma nova senha forte para sua conta."
      footer={
        <>
          Voltar para{" "}
          <Link to="/login" className="font-medium text-foreground hover:text-primary transition-colors">
            login
          </Link>
        </>
      }
    >
      <div className="space-y-4">
        <p className="rounded-lg border border-border bg-surface/40 p-3 text-xs text-muted-foreground">
          Simulação: o token recebido por e-mail seria validado aqui. Nenhum token real é verificado.
        </p>
        <PasswordResetMockForm />
        <EmailSecurityNotice compact />
      </div>
    </AuthLayout>
  );
}
