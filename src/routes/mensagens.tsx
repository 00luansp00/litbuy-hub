import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth/AuthGate";
import { ConversationsList } from "@/components/messages/ConversationsList";
import { MessageEmptyState } from "@/components/messages/MessageEmptyState";
import { MessageSecurityNotice } from "@/components/messages/MessageSecurityNotice";
import { messageService } from "@/services/messageService";

export const Route = createFileRoute("/mensagens")({
  loader: async () => {
    const conversations = await messageService.getConversations();
    return { conversations };
  },
  component: MensagensPage,
  head: () => ({
    meta: [
      { title: "Mensagens — LIT Buy" },
      {
        name: "description",
        content:
          "Suas conversas com vendedores e suporte da LIT Buy. Comunicação dentro da plataforma para sua segurança.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function MensagensPage() {
  const { conversations } = Route.useLoaderData();
  const first = conversations[0];

  return (
    <AuthGate
      title="Entre para acessar suas mensagens"
      description="Você precisa estar logado para ver suas conversas com vendedores."
    >
      <div className="container-lit py-6 md:py-10">
        <header className="mb-4 md:mb-6">
          <h1 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">
            Mensagens
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Converse com vendedores antes e depois da compra.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-[320px_minmax(0,1fr)] md:gap-6">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card md:max-h-[70vh]">
            <ConversationsList conversations={conversations} />
          </div>

          {/* Desktop: painel vazio à direita */}
          <div className="hidden md:flex md:flex-col md:gap-4">
            <div className="min-h-[60vh] rounded-2xl border border-border bg-card p-6 shadow-card">
              <MessageEmptyState
                title="Selecione uma conversa"
                description={
                  first
                    ? `Escolha uma conversa à esquerda. Ex.: “${first.counterpart.name}”.`
                    : "Você ainda não tem conversas. Elas aparecerão aqui."
                }
              />
              {first && (
                <div className="mt-4 flex justify-center">
                  <Link
                    to="/mensagens/$id"
                    params={{ id: first.id }}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Abrir última conversa →
                  </Link>
                </div>
              )}
            </div>
            <MessageSecurityNotice />
          </div>
        </div>
      </div>
    </AuthGate>
  );
}
