import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowDown,
  BookOpen,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ReportButton } from "@/components/report/ReportButton";
import { OrderChatMediationBanner } from "@/components/orders/OrderChatMediationBanner";
import { messageService } from "@/services/messageService";
import { analyticsService } from "@/services/analyticsService";
import {
  getMediationDeadline,
  getOrderSystemMessages,
} from "@/services/orderSupportService";
import { sanitizeExternalContact } from "@/utils/moderation";
import type { Conversation, ConversationMessage, Order } from "@/types";

interface OrderChatCardProps {
  order: Order;
  onReportProblem?: () => void;
  perspective?: "buyer" | "seller";
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (isSameDay(d, today)) return "Hoje";
  if (isSameDay(d, yesterday)) return "Ontem";
  return d.toLocaleDateString("pt-BR");
}

export function OrderChatCard({
  order,
  onReportProblem,
  perspective = "buyer",
}: OrderChatCardProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const mediation = useMemo(() => getMediationDeadline(order), [order]);
  const systemMessages = useMemo(() => getOrderSystemMessages(order), [order]);

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
    analyticsService.track("order_chat_system_notice_viewed_mocked", {
      orderId: order.id,
    });
    return () => {
      mounted = false;
    };
  }, [order.id]);

  const automatic =
    order.hasAutomaticMessage && order.automaticMessage
      ? { id: "auto-1", text: sanitizeExternalContact(order.automaticMessage) }
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
    // scroll to bottom
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setShowScrollBtn(!nearBottom && messages.length > 3);
  };

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  const openReport = () => {
    analyticsService.track("order_problem_clicked_mocked", {
      orderId: order.id,
      perspective,
    });
    onReportProblem?.();
  };

  // Group messages by day for dividers
  const dividers = useMemo(() => {
    const seen = new Set<string>();
    return messages.map((m) => {
      const key = dayLabel(m.sentAt);
      const show = !seen.has(key);
      seen.add(key);
      return { message: m, divider: show ? key : null };
    });
  }, [messages]);

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <header className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <div>
            <h3 className="text-lg font-bold text-foreground">
              Chat oficial do pedido
            </h3>
            <p className="text-xs text-muted-foreground">
              Este chat é o canal oficial de comunicação deste pedido na LIT
              Buy.
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="text-[10px]">
          Pedido {order.code}
        </Badge>
      </header>

      {/* Manual de instruções */}
      <div className="mb-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs">
        <div className="flex items-start gap-2">
          <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="font-semibold text-foreground">
              IMPORTANTE: Leia o Manual de Instruções.
            </p>
            <p className="mt-0.5 text-muted-foreground">
              A leitura das instruções para compradores e vendedores é
              obrigatória. Ao prosseguir com a negociação, ambas as partes
              declaram estar cientes das regras da LIT Buy. Reclamações
              decorrentes do descumprimento dessas orientações poderão não ser
              consideradas.
            </p>
            <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
              <Link
                to="/regras-da-plataforma"
                className="font-medium text-primary hover:underline"
              >
                Manual de instruções
              </Link>
              <Link
                to="/seguranca"
                className="font-medium text-primary hover:underline"
              >
                Segurança
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Banner de prazo + Reportar problema */}
      <OrderChatMediationBanner
        window={mediation}
        perspective={perspective}
        onReport={openReport}
      />

      <div className="mb-3 rounded-xl border border-border bg-surface/40 p-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-success" />
          <span>
            Mantenha toda a comunicação na LIT Buy. Conversar por fora reduz sua
            proteção. Este chat pode ser usado como evidência em mediação.
          </span>
        </div>
      </div>

      <div className="relative">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="mb-3 max-h-72 space-y-2 overflow-y-auto rounded-xl border border-border bg-background p-3"
        >
          {/* Mensagens automáticas do sistema */}
          {systemMessages.map((s) => (
            <div
              key={s.id}
              className="rounded-lg border border-border bg-surface/60 p-2 text-xs text-muted-foreground"
            >
              <div className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                {s.tag ?? "Sistema"}
              </div>
              {s.text}
            </div>
          ))}

          {/* Mensagem automática do vendedor (LIT-MAX) */}
          {automatic && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 text-sm">
              <div className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-primary">
                Mensagem automática do vendedor
                <Badge variant="outline" className="text-[9px]">
                  LIT-MAX
                </Badge>
              </div>
              <p className="text-foreground">{automatic.text}</p>
            </div>
          )}

          {messages.length === 0 && !automatic && (
            <p className="text-sm text-muted-foreground">
              Nenhuma mensagem ainda. Envie a primeira para iniciar a conversa.
            </p>
          )}

          {dividers.map(({ message: m, divider }) => (
            <div key={m.id}>
              {divider && (
                <div className="my-2 flex items-center gap-2">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {divider}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              )}
              <div
                className={
                  m.authorRole === perspective
                    ? "ml-auto max-w-[80%] rounded-lg bg-primary/10 p-2 text-sm text-foreground"
                    : m.system
                      ? "rounded-lg border border-warning/30 bg-warning/5 p-2 text-xs text-warning"
                      : "max-w-[80%] rounded-lg bg-surface p-2 text-sm text-foreground"
                }
              >
                {m.text}
              </div>
            </div>
          ))}
        </div>
        {showScrollBtn && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="absolute bottom-4 right-4 h-8 rounded-full shadow"
            onClick={scrollToBottom}
          >
            <ArrowDown className="h-3.5 w-3.5" /> Última mensagem
          </Button>
        )}
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
            onClick={openReport}
            disabled={mediation.isExpired}
          >
            {mediation.isExpired ? "Prazo encerrado" : "Reportar problema"}
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
