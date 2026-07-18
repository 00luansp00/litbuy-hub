import { FormEvent, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Store, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AuthGate } from "@/components/auth/AuthGate";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/providers/AuthContext";
import { sellerOnboardingService } from "@/services/sellerOnboardingService";

export const Route = createFileRoute("/perfil/vendedor")({
  component: SellerProfileOnboardingPage,
});
const key = ["seller-onboarding", "me"] as const;
function statusLabel(status?: string) {
  return (
    (
      {
        draft: "Rascunho",
        submitted: "Enviado para análise",
        under_review: "Em análise",
        approved: "Aprovado",
        rejected: "Rejeitado",
      } as Record<string, string>
    )[status ?? ""] ?? "Sem solicitação"
  );
}

function SellerProfileOnboardingPage() {
  const { reloadCurrentUser, hasSellerAccess } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: key,
    queryFn: sellerOnboardingService.me,
  });
  const [storeName, setStoreName] = useState("");
  const [requestedSlug, setRequestedSlug] = useState("");
  const [description, setDescription] = useState("");
  const [accepted, setAccepted] = useState(false);
  useEffect(() => {
    if (data?.application) {
      setStoreName(data.application.storeName);
      setRequestedSlug(data.application.requestedSlug);
      setDescription(data.application.description ?? "");
      setAccepted(
        data.requirements.sellerAgreementAccepted && data.requirements.sellerAgreementCurrent,
      );
    }
    if (data?.application?.status === "approved") void reloadCurrentUser();
  }, [data?.application?.id, data?.application?.status, reloadCurrentUser]);
  const save = useMutation({
    mutationFn: () =>
      sellerOnboardingService.saveDraft({
        storeName,
        requestedSlug,
        description,
        sellerAgreementAccepted: accepted,
      }),
    onSuccess: () => {
      toast.success("Rascunho salvo.");
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const submit = useMutation({
    mutationFn: async () => {
      await sellerOnboardingService.saveDraft({
        storeName,
        requestedSlug,
        description,
        sellerAgreementAccepted: accepted,
      });
      return sellerOnboardingService.submit();
    },
    onSuccess: () => {
      toast.success("Solicitação enviada para análise.");
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const app = data?.application;
  const editable = !app || app.status === "draft" || app.status === "rejected";
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };
  return (
    <AuthGate title="Solicitar acesso de vendedor">
      <main className="container-lit py-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Store />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Onboarding de vendedor</h1>
            <p className="text-sm text-muted-foreground">
              Solicitação real, persistente e analisada por administradores. Sem KYC externo nesta
              etapa.
            </p>
          </div>
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Não foi possível carregar</AlertTitle>
            <AlertDescription>{(error as Error).message}</AlertDescription>
          </Alert>
        )}
        {isLoading || !data ? (
          <p className="text-sm text-muted-foreground">Carregando requisitos...</p>
        ) : (
          <>
            <section className="grid gap-3 md:grid-cols-3">
              {[
                ["E-mail confirmado", data.requirements.emailVerified],
                ["Telefone confirmado", data.requirements.phoneVerified],
                ["Idade mínima de 18 anos", data.requirements.ageEligible],
              ].map(([label, ok]) => (
                <div key={String(label)} className="rounded-xl border bg-card p-4 text-sm">
                  <span className={ok ? "text-success" : "text-destructive"}>{ok ? "✓" : "!"}</span>{" "}
                  {label}
                  {label === "Telefone confirmado" && !ok && (
                    <Link to="/perfil/seguranca" className="ml-2 text-primary underline">
                      verificar
                    </Link>
                  )}
                </div>
              ))}
            </section>
            <Alert>
              <AlertTitle>Status: {statusLabel(app?.status)}</AlertTitle>
              <AlertDescription>
                Versão das regras do vendedor: {data.requirements.sellerAgreementVersion}.{" "}
                {data.requirements.sellerAgreementCurrent
                  ? "A versão vigente já foi aceita."
                  : "É necessário aceitar a versão vigente antes de enviar."}{" "}
                O texto permanece pendente de revisão jurídica e poderá mudar antes de produção.
              </AlertDescription>
            </Alert>
            {app?.status === "submitted" && (
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertTitle>Enviado para análise</AlertTitle>
                <AlertDescription>
                  Enviado em{" "}
                  {app.submittedAt
                    ? new Date(app.submittedAt).toLocaleString("pt-BR")
                    : "data indisponível"}
                  . Ainda não há acesso ao painel.
                </AlertDescription>
              </Alert>
            )}
            {app?.status === "under_review" && (
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertTitle>Em análise</AlertTitle>
                <AlertDescription>
                  Nossa equipe está revisando. Não há prazo garantido nesta fase.
                </AlertDescription>
              </Alert>
            )}
            {app?.status === "rejected" && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Solicitação rejeitada: {app.rejectionCode}</AlertTitle>
                <AlertDescription>
                  {app.rejectionReason ?? "Corrija os dados públicos da loja e envie novamente."}
                </AlertDescription>
              </Alert>
            )}
            {app?.status === "approved" && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Solicitação aprovada</AlertTitle>
                <AlertDescription>
                  A conta de vendedor é real; o selo verificado/KYC permanece pendente.{" "}
                  {hasSellerAccess
                    ? "Papel seller confirmado."
                    : "Atualizando papéis via /auth/me..."}
                </AlertDescription>
              </Alert>
            )}
            {editable && (
              <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border bg-card p-5">
                <Input
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="Nome da loja"
                  maxLength={60}
                />
                <Input
                  value={requestedSlug}
                  onChange={(e) => setRequestedSlug(e.target.value)}
                  placeholder="slug-da-loja"
                  maxLength={40}
                />
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descrição pública em texto simples (opcional)"
                  maxLength={500}
                />
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} />{" "}
                  Aceito explicitamente as regras de vendedor.
                </label>
                <div className="flex gap-3">
                  <Button type="submit" disabled={save.isPending}>
                    Salvar rascunho
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => submit.mutate()}
                    disabled={submit.isPending}
                  >
                    Enviar para análise
                  </Button>
                </div>
              </form>
            )}
            {app?.status === "approved" && (
              <Button asChild>
                <Link to="/vendedor">Ir para o painel do vendedor</Link>
              </Button>
            )}
          </>
        )}
      </main>
    </AuthGate>
  );
}
