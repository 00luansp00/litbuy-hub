import { createFileRoute } from "@tanstack/react-router";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { LoginVerificationPanel } from "@/components/email/LoginVerificationPanel";
import { EmailSecurityNotice } from "@/components/email/EmailSecurityNotice";
import { useAuth } from "@/providers/AuthProvider";

export const Route = createFileRoute("/verificacao-login")({
  component: VerificacaoLoginPage,
  head: () => ({
    meta: [
      { title: "Verificação de dispositivo — LIT Buy" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Verificação de novo dispositivo em modo demonstração." },
    ],
  }),
});

function VerificacaoLoginPage() {
  const { user } = useAuth();
  return (
    <AuthLayout
      eyebrow="Segurança"
      title="Verificação de acesso"
      subtitle="Detectamos um acesso a partir de um novo dispositivo."
    >
      <div className="space-y-4">
        <LoginVerificationPanel email={user?.email ?? "voce@exemplo.com"} />
        <EmailSecurityNotice compact />
      </div>
    </AuthLayout>
  );
}
