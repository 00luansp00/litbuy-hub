import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { EmailVerificationCard } from "@/components/email/EmailVerificationCard";
import { EmailSecurityNotice } from "@/components/email/EmailSecurityNotice";
import { analyticsService } from "@/services/analyticsService";
import { useAuth } from "@/providers/AuthProvider";

export const Route = createFileRoute("/verificar-email")({
  component: VerificarEmailPage,
  head: () => ({
    meta: [
      { title: "Verifique seu e-mail — LIT Buy" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Confirme o seu e-mail para acessar a LIT Buy (modo demonstração)." },
    ],
  }),
});

function VerificarEmailPage() {
  const { user } = useAuth();
  const email = user?.email ?? "voce@exemplo.com";
  useEffect(() => {
    analyticsService.track("email_verification_viewed_mocked");
  }, []);
  return (
    <AuthLayout eyebrow="Verificação" title="Verifique seu e-mail" subtitle="Confirme sua conta na LIT Buy.">
      <div className="space-y-4">
        <EmailVerificationCard email={email} />
        <EmailSecurityNotice />
      </div>
    </AuthLayout>
  );
}
