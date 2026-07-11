import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { MessageSquare, ShieldCheck, ExternalLink, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ReportButton } from "@/components/report/ReportButton";
import { messageService } from "@/services/messageService";
import { analyticsService } from "@/services/analyticsService";
import type { Conversation, ConversationMessage, Order } from "@/types";

interface OrderChatCardProps {
  order: Order;
  onReportProblem?: () => void;
}

export function OrderChatCard({ order, onReportProblem }: OrderChatCardProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const conv = await messageService.getConversationByOrderId(order.id);
      if (!mounted) return;
      setConversation(conv);
      if (conv) {
        const msgs = await messageService.getOrderConversationMessages(order.id);
        if (!mounted) return;
        setMessages(msgs);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [order.id]);

  const automatic =
    order.hasAutomaticMessage && order.automaticMessage
      ? {
          id: "auto-1",
          text: order.automaticMessage,
        }
      : null;

  const handleSend = async () => {
    if (!text.trim() || !conversation) return;
    setSending(true);
    const msg = await messageService.simulateSendOrderMessage(
      conversation.id,
      text.trim(),
    );
    setMessages((prev) => [...prev, msg]);
    setText("");
    setSending(false);
    toast("Mensagem enviada (mock)", {
      description: "Modo demonstração — nada foi persistido.",
    });
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <header className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-bold text-foreground">Chat com o vendedor</h3>
        </div>
        <Badge variant="secondary" className="text-[10px]">
          Vinculado ao pedido
        </Badge>
      </header>

      <div className="mb-3 rounded-xl border border-border bg-surface/40 p-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-success" />
          <span>
            Mantenha toda a comunicação na LIT Buy. Conversar por fora reduz sua
            proteção.
          </span>
        </div>
      </div>

      <div className="mb-3 max-h-72 space-y-2 overflow-y-auto rounded-xl border border-border bg-background p-3">
        {automatic && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 text-sm">
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-primary">
              Mensagem automática do vendedor
            </div>
            <p className="text-foreground">{automatic.text}</p>
          </div>
        )}
        {messages.length === 0 && !automatic && (
          <p className="text-sm text-muted-foreground">
            Nenhuma mensagem ainda. Envie a primeira para iniciar a conversa.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={
              m.authorRole === "buyer"
                ? "ml-auto max-w-[80%] rounded-lg bg-primary/10 p-2 text-sm text-foreground"
                : m.system
                  ? "rounded-lg border border-warning/30 bg-warning/5 p-2 text-xs text-warning"
                  : "max-w-[80%] rounded-lg bg-surface p-2 text-sm text-foreground"
            }
          >
            {m.text}
          </div>
        ))}
      </div>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Escreva uma mensagem…"
        rows={2}
        className="mb-2"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-[11px] text-warning">
          <AlertTriangle className="h-3 w-3" />
          Nunca compartilhe senha, contato externo ou dados de cartão.
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onReportProblem}
          >
            Reportar problema
          </Button>
          {conversation && (
            <ReportButton
              targetType="conversation"
              targetId={conversation.id}
              targetLabel={`Chat do pedido ${order.code}`}
              label="Denunciar conversa"
              variant="ghost"
              size="sm"
              source="chat_order"
              context={{
                conversationId: conversation.id,
                orderId: order.id,
                orderCode: order.code,
              }}
            />
          )}
          {conversation && (
            <Button asChild variant="ghost" size="sm">
              <Link to="/mensagens/$id" params={{ id: conversation.id }}>
                <ExternalLink className="h-3.5 w-3.5" /> Abrir conversa completa
              </Link>
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            disabled={!text.trim() || sending || !conversation}
            onClick={() => {
              analyticsService.track("order_conversation_created_mocked", {
                orderId: order.id,
              });
              void handleSend();
            }}
          >
            Enviar
          </Button>
        </div>
      </div>
    </section>
  );
}
