import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertOctagon, Clock, Receipt } from "lucide-react";
import { toast } from "sonner";
import { AuthGate } from "@/components/auth/AuthGate";
import { ConversationContextCard } from "@/components/messages/ConversationContextCard";
import { ConversationHeader } from "@/components/messages/ConversationHeader";
import { ConversationsList } from "@/components/messages/ConversationsList";
import { MessageComposer } from "@/components/messages/MessageComposer";
import { MessageSecurityNotice } from "@/components/messages/MessageSecurityNotice";
import { MessagesThread } from "@/components/messages/MessagesThread";
import { OrderProblemDialog } from "@/components/orders/OrderProblemDialog";
import { ReportButton } from "@/components/report/ReportButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { messageService } from "@/services/messageService";
import { orderService } from "@/services/orderService";
import { getMediationDeadline } from "@/services/orderSupportService";
import type { ConversationMessage, Order } from "@/types";

export const Route = createFileRoute("/mensagens/$id")({
  loader: async ({ params }) => {
    const [conversation, conversations] = await Promise.all([
      messageService.getConversationById(params.id),
      messageService.getConversations(),
    ]);
    if (!conversation) throw notFound();
    const messages = await messageService.getConversationMessages(
      conversation.id,
    );
    const orderId = conversation.context?.orderId;
    const order =
      conversation.type === "order_related" && orderId
        ? (await orderService.getOrderById(orderId)) ?? null
        : null;
    return { conversation, conversations, messages, order };
  },
  component: ConversationDetailPage,
  notFoundComponent: ConversationNotFound,
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `Conversa com ${loaderData.conversation.counterpart.name} — LIT Buy`
          : "Conversa — LIT Buy",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function ConversationDetailPage() {
  const { conversation, conversations, messages: initial, order } =
    Route.useLoaderData();
  const currentUser = messageService.getCurrentUser();
  const [messages, setMessages] = useState<ConversationMessage[]>(initial);
  const [problemOpen, setProblemOpen] = useState(false);

  const mediationWindow = useMemo(
    () => (order ? getMediationDeadline(order as Order) : null),
    [order],
  );

  const handleSend = async (text: string) => {
    const msg = await messageService.simulateSendMessage(
      conversation.id,
      text,
    );
    setMessages((prev) => [...prev, msg]);
    toast("Mensagem enviada", {
      description: "Modo demonstração — nada foi persistido.",
    });
  };

  return (
    <AuthGate
      title="Entre para acessar a conversa"
      description="Você precisa estar logado para ver esta conversa."
    >

      <div className="container-lit py-6 md:py-10">
        <div className="grid gap-4 md:grid-cols-[320px_minmax(0,1fr)] md:gap-6">
          {/* Lista à esquerda no desktop */}
          <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-card md:block md:max-h-[80vh]">
            <ConversationsList
              conversations={conversations}
              activeId={conversation.id}
            />
          </div>

          {/* Conversa aberta */}
          <div className="flex flex-col gap-3">
            {order && mediationWindow && (
              <div className="rounded-2xl border border-warning/30 bg-warning/5 p-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge className="bg-primary/15 text-primary border-primary/30">
                      Pedido vinculado
                    </Badge>
                    <span className="font-medium text-foreground">
                      {order.code}
                    </span>
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3 w-3" /> Prazo de mediação:{" "}
                      {new Date(mediationWindow.deadlineDate).toLocaleString(
                        "pt-BR",
                        { dateStyle: "short", timeStyle: "short" },
                      )}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      · Conversa oficial vinculada ao pedido
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link to="/pedidos/$id" params={{ id: order.id }}>
                        <Receipt className="h-3.5 w-3.5" /> Ver pedido
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant={mediationWindow.isExpired ? "outline" : "default"}
                      onClick={() => setProblemOpen(true)}
                      disabled={mediationWindow.isExpired}
                    >
                      <AlertOctagon className="h-3.5 w-3.5" />
                      {mediationWindow.isExpired
                        ? "Prazo encerrado"
                        : "Reportar problema"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
            <div className="flex min-h-[70vh] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card">
              <ConversationHeader conversation={conversation} />
              <ConversationContextCard context={conversation.context} />
              <MessagesThread
                messages={messages}
                currentUserId={currentUser.id}
                counterpart={conversation.counterpart}
              />
              <MessageComposer onSend={handleSend} />
            </div>

            <MessageSecurityNotice />
            <div className="flex flex-wrap justify-end gap-2">
              <ReportButton
                targetType="conversation"
                targetId={conversation.id}
                targetLabel={`Conversa com ${conversation.counterpart.name}`}
                label="Denunciar conversa"
                variant="outline"
                size="sm"
                source="message_thread"
                context={{
                  conversationId: conversation.id,
                  sellerId: conversation.counterpart.sellerSlug
                    ? conversation.counterpart.id
                    : undefined,
                  orderId:
                    conversation.type === "order_related"
                      ? conversation.context?.orderId
                      : undefined,
                }}
              />
              <ReportButton
                targetType="message"
                targetId={conversation.id}
                targetLabel={`Última mensagem em conversa com ${conversation.counterpart.name}`}
                label="Reportar contato externo"
                variant="ghost"
                size="sm"
                source="message_thread"
                defaultReason="external_contact_attempt"
                context={{ conversationId: conversation.id }}
              />
            </div>
          </div>
        </div>
      </div>
    </AuthGate>
  );
}

function ConversationNotFound() {
  return (
    <div className="container-lit py-16 text-center">
      <h1 className="text-2xl font-bold text-foreground">
        Conversa não encontrada
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        A conversa que você procura não existe ou foi removida.
      </p>
    </div>
  );
}
