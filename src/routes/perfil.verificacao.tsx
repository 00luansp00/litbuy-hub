import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AuthGate } from "@/components/auth/AuthGate";
import { AccountLayout } from "@/components/account/AccountLayout";
import { AccountHeader } from "@/components/account/AccountHeader";
import { VerificationStatusCard } from "@/components/verification/VerificationStatusCard";
import { VerificationSteps } from "@/components/verification/VerificationSteps";
import { VerificationBasicStep } from "@/components/verification/VerificationBasicStep";
import { VerificationSmsStep } from "@/components/verification/VerificationSmsStep";
import { VerificationDocumentStep } from "@/components/verification/VerificationDocumentStep";
import { VerificationSelfieStep } from "@/components/verification/VerificationSelfieStep";
import { VerificationReviewStep } from "@/components/verification/VerificationReviewStep";
import { VerificationTimeline } from "@/components/verification/VerificationTimeline";
import { VerificationSecurityNotice } from "@/components/verification/VerificationSecurityNotice";
import { accountService } from "@/services/accountService";
import { verificationService } from "@/services/verificationService";
import type {
  VerificationAcceptedDocument,
  VerificationStatus,
  VerificationStep,
  VerificationTimelineEvent,
} from "@/types";

export const Route = createFileRoute("/perfil/verificacao")({
  loader: async () => {
    const [summary, status, steps, docs, timeline] = await Promise.all([
      accountService.getAccountSummary(),
      verificationService.getVerificationStatus(),
      verificationService.getVerificationSteps(),
      verificationService.getAcceptedDocuments(),
      verificationService.getVerificationTimeline(),
    ]);
    return { summary, status, steps, docs, timeline };
  },
  component: VerificacaoPage,
});

const STEP_IDS: VerificationStep["id"][] = ["basic", "sms", "document", "selfie", "review"];

function VerificacaoPage() {
  const { summary, status: initialStatus, steps: initialSteps, docs, timeline: initialTimeline } =
    Route.useLoaderData();

  const [status, setStatus] = useState<VerificationStatus>(initialStatus);
  const [steps, setSteps] = useState<VerificationStep[]>(initialSteps);
  const [current, setCurrent] = useState<VerificationStep["id"]>("basic");
  const [timeline, setTimeline] = useState<VerificationTimelineEvent[]>(initialTimeline);

  const advance = (from: VerificationStep["id"]) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === from ? { ...s, status: "completed" } : s)),
    );
    if (status === "not_started") setStatus("in_progress");
    const idx = STEP_IDS.indexOf(from);
    if (idx < STEP_IDS.length - 1) setCurrent(STEP_IDS[idx + 1]!);
  };

  const handleSubmitted = () => {
    setStatus("pending_review");
    setTimeline((t) => [
      {
        id: `vt-${Date.now()}`,
        date: new Date().toISOString(),
        title: "Enviado para análise",
        description: "A equipe LIT irá revisar os dados (mock).",
        tone: "info",
      },
      ...t,
    ]);
    toast.success("Verificação enviada para análise");
  };

  return (
    <AuthGate>
      <AccountLayout
        header={
          <AccountHeader
            memberSince={summary.memberSince}
            verified={summary.verified}
            level={summary.level}
          />
        }
        title="Verificação de identidade"
        description="Aumente a confiança da sua conta e ganhe o selo Vendedor Verificado."
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6 min-w-0">
            <VerificationStatusCard status={status} compact />

            <section className="rounded-2xl border border-border bg-card p-5 shadow-card space-y-4">
              <header>
                <h3 className="text-base font-semibold text-foreground">Etapas</h3>
                <p className="text-xs text-muted-foreground">
                  Você pode navegar entre as etapas. Nada é persistido.
                </p>
              </header>
              <VerificationSteps steps={steps} currentStepId={current} onSelect={setCurrent} />

              <div className="rounded-xl border border-border bg-surface/40 p-4">
                {current === "basic" && <VerificationBasicStep onContinue={() => advance("basic")} />}
                {current === "sms" && <VerificationSmsStep onContinue={() => advance("sms")} />}
                {current === "document" && (
                  <VerificationDocumentStep
                    documents={docs as VerificationAcceptedDocument[]}
                    onContinue={() => advance("document")}
                  />
                )}
                {current === "selfie" && <VerificationSelfieStep onContinue={() => advance("selfie")} />}
                {current === "review" && <VerificationReviewStep onSubmitted={handleSubmitted} />}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <h3 className="text-base font-semibold text-foreground">Benefícios</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>• Selo <strong className="text-foreground">Vendedor Verificado</strong> na sua loja.</li>
                <li>• Maior confiança de compradores.</li>
                <li>• Elegível a limites e recursos avançados.</li>
                <li>• Requisito futuro para saques maiores.</li>
              </ul>
            </section>
            <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <h3 className="text-base font-semibold text-foreground">Histórico</h3>
              <div className="mt-3">
                <VerificationTimeline events={timeline} />
              </div>
            </section>
            <VerificationSecurityNotice />
          </aside>
        </div>
      </AccountLayout>
    </AuthGate>
  );
}
