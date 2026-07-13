import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Package,
  User,
  CreditCard,
  Truck,
  MessageSquare,
  ShieldCheck,
  ExternalLink,
  Lock,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { formatBRL } from "@/lib/format";
import { OrderMediationCard } from "@/components/orders/OrderMediationCard";
import { OrderChatMediationBanner } from "@/components/orders/OrderChatMediationBanner";
import { OrderProblemDialog } from "@/components/orders/OrderProblemDialog";
import { ReportButton } from "@/components/report/ReportButton";
import { sellerSaleService } from "@/services/sellerSaleService";
import { messageService } from "@/services/messageService";
import { analyticsService } from "@/services/analyticsService";
import { getSupportWindow } from "@/services/orderSupportService";
import type {
  Conversation,
  ConversationMessage,
  SaleDeliveryStatus,
  SellerSaleDetail,
} from "@/types";

const DELIVERY_STATUS_LABEL: Record<SaleDeliveryStatus, string> = {
  awaiting_payment: "Aguardando pagamento",
  payment_approved: "Pagamento aprovado",
  awaiting_seller_delivery: "Aguardando entrega do vendedor",
  delivered_by_seller: "Entrega enviada",
  automatic_delivery_released: "Entrega automática liberada",
  awaiting_buyer_confirmation: "Aguardando confirmação do comprador",
  completed: "Concluída",
  disputed: "Em disputa",
  cancelled: "Cancelada",
  refunded: "Estornada",
};

interface Props {
  sale: SellerSaleDetail;
}

export function SellerSaleDetailView({ sale }: Props) {
  const [instructions, setInstructions] = useState("");
  const [status, setStatus] = useState<SaleDeliveryStatus>(sale.deliveryStatus);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [reply, setReply] = useState("");
  const [problemOpen, setProblemOpen] = useState(false);

  const supportWindow = getSupportWindow({
    createdAt: sale.createdAt,
    deliveryMode: sale.deliveryMode,
    protectionLitActive: sale.protectionLitActive,
    categoryHint: sale.productTitle,
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      const conv = await messageService.getSellerSaleConversation(sale.id);
      if (!mounted) return;
      setConversation(conv);
      if (conv) {
        const msgs = await messageService.getConversationMessages(conv.id);
        if (mounted) setMessages(msgs);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [sale.id]);

  const handleSendInstructions = async () => {
    if (!instructions.trim()) return;
    await sellerSaleService.simulateSendDeliveryInstructions(
      sale.id,
      instructions,
    );
    analyticsService.track("seller_delivery_sent_mocked", { saleId: sale.id });
    setInstructions("");
    toast.success("Instruções enviadas (mock)");
  };

  const handleMarkDelivered = async () => {
    await sellerSaleService.simulateMarkAsDelivered(sale.id);
    analyticsService.track("seller_delivery_sent_mocked", { saleId: sale.id });
    setStatus("delivered_by_seller");
    toast.success("Venda marcada como entregue (mock)");
  };

  const handleReply = async () => {
    if (!reply.trim() || !conversation) return;
    const msg = await messageService.simulateSendOrderMessage(
      conversation.id,
      reply.trim(),
    );
    setMessages((prev) => [...prev, msg]);
    setReply("");
    toast("Resposta enviada (mock)");
  };

  const handleSellerResponse = async () => {
    await sellerSaleService.simulateSubmitSellerResponse(
      sale.id,
      "Réplica mockada do vendedor.",
    );
    analyticsService.track("seller_response_submitted_mocked", {
      saleId: sale.id,
    });
    toast.success("Réplica enviada (mock)");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-6">
        {/* Cabeçalho da venda */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs text-muted-foreground">
                Venda #{sale.code} · Pedido {sale.orderCode}
              </div>
              <h2 className="mt-1 text-xl font-bold text-foreground">
                {sale.productTitle}
              </h2>
              {sale.variationLabel && (
                <p className="text-xs text-muted-foreground">
                  {sale.variationLabel}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge>{DELIVERY_STATUS_LABEL[status]}</Badge>
              {sale.protectionLitActive && (
                <Badge className="bg-success/15 text-success border-success/30">
                  <ShieldCheck className="mr-1 h-3 w-3" /> Proteção LIT
                </Badge>
              )}
              {sale.sellerPlan && (
                <Badge variant="secondary" className="capitalize">
                  Plano {sale.sellerPlan}
                </Badge>
              )}
            </div>
          </div>

          <Separator className="my-4" />

          <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <Info label="Comprador" icon={<User className="h-3.5 w-3.5" />}>
              <div className="flex items-center gap-2">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={sale.buyerAvatar} alt={sale.buyerName} />
                  <AvatarFallback className="text-[9px]">
                    {sale.buyerName.slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <span>{sale.buyerName}</span>
              </div>
            </Info>
            <Info label="Pagamento" icon={<CreditCard className="h-3.5 w-3.5" />}>
              {sale.paymentMethod}
            </Info>
            <Info label="Entrega" icon={<Truck className="h-3.5 w-3.5" />}>
              {sale.deliveryMode === "automatic" ? "Automática" : "Manual"}
            </Info>
            <Info label="Data">
              {new Date(sale.createdAt).toLocaleDateString("pt-BR")}
            </Info>
          </dl>

          <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-border pt-3">
            <ReportButton
              targetType="user"
              targetId={sale.buyerId ?? sale.id}
              targetLabel={sale.buyerName}
              label="Reportar comprador"
              variant="ghost"
              size="sm"
              source="sale_page"
              context={{
                saleId: sale.id,
                orderId: sale.orderId,
                buyerId: sale.buyerId,
                productId: sale.productId,
                conversationId: sale.conversationId,
              }}
            />
            <ReportButton
              targetType="sale"
              targetId={sale.id}
              targetLabel={`Venda ${sale.code}`}
              label="Reportar problema na venda"
              variant="ghost"
              size="sm"
              source="sale_page"
              context={{
                saleId: sale.id,
                orderId: sale.orderId,
                buyerId: sale.buyerId,
                productId: sale.productId,
              }}
            />
          </div>
        </section>

        {/* Produto */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center gap-3">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-surface">
              <img
                src={sale.productImage}
                alt={sale.productTitle}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground">
                {sale.productTitle}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatBRL(sale.amount)}
              </div>
              <Link
                to="/produto/$id"
                params={{ id: sale.productSlug }}
                className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Ver anúncio <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </section>

        {/* Entrega */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <header className="mb-3 flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold text-foreground">Entrega da venda</h3>
          </header>

          {sale.deliveryMode === "manual" ? (
            <div className="space-y-3">
              <Textarea
                rows={3}
                placeholder="Instruções seguras para o comprador (sem dados fora da LIT Buy)"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
              <p className="text-[11px] text-warning">
                Nunca envie contato externo, senha real ou link fora da LIT Buy.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={handleSendInstructions}>
                  Enviar instruções
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleMarkDelivered}
                >
                  Marcar como entregue
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="rounded-lg border border-border bg-surface/40 p-3">
                <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" /> Entrega automática liberada
                </div>
                <div className="font-mono text-foreground">
                  {sale.automaticDelivery?.maskedPayload}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {sale.automaticDelivery?.unitsRemaining}/
                  {sale.automaticDelivery?.unitsTotal} unidades restantes no
                  cofre (mock)
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Modo demonstração. Cofre real exigirá criptografia, auditoria e
                backend seguro.
              </p>
            </div>
          )}
        </section>

        {/* Chat oficial do pedido — visão vendedor */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <header className="mb-3 flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  Chat oficial do pedido
                </h3>
                <p className="text-xs text-muted-foreground">
                  Se houver problema com o comprador ou com a entrega, use este
                  canal para solicitar análise da LIT Buy.
                </p>
              </div>
            </div>
            {conversation && (
              <Button asChild variant="ghost" size="sm">
                <Link to="/mensagens/$id" params={{ id: conversation.id }}>
                  <ExternalLink className="h-3.5 w-3.5" /> Conversa completa
                </Link>
              </Button>
            )}
          </header>

          <OrderChatMediationBanner
            window={supportWindow}
            perspective="seller"
            onReport={() => {
              analyticsService.track("order_problem_clicked_mocked", {
                saleId: sale.id,
                perspective: "seller",
              });
              setProblemOpen(true);
            }}
          />


          <div className="mb-3 max-h-60 space-y-2 overflow-y-auto rounded-xl border border-border bg-background p-3">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhuma mensagem ainda.
              </p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.authorRole === "seller"
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
            rows={2}
            placeholder="Responder ao comprador…"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[11px] text-warning">
              Nunca peça contato externo ou dados fora da LIT Buy.
            </p>
            <Button size="sm" onClick={handleReply} disabled={!reply.trim()}>
              Enviar
            </Button>
          </div>
        </section>

        {sale.mediation && (
          <>
            <OrderMediationCard
              mediation={sale.mediation}
              perspective="seller"
            />
            <div className="rounded-2xl border border-border bg-card p-4">
              <Button size="sm" onClick={handleSellerResponse}>
                Enviar réplica (mock)
              </Button>
            </div>
          </>
        )}

        {/* Timeline operacional */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h3 className="mb-3 text-lg font-bold text-foreground">Timeline</h3>
          <ol className="space-y-2 text-sm">
            {sale.timeline.map((e) => (
              <li key={e.id} className="flex items-start gap-2">
                <span
                  className={
                    "mt-1 inline-block h-2 w-2 shrink-0 rounded-full " +
                    (e.pending ? "bg-muted" : "bg-primary")
                  }
                />
                <div>
                  <div
                    className={
                      e.pending ? "text-muted-foreground" : "text-foreground"
                    }
                  >
                    {e.label}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(e.at).toLocaleString("pt-BR")}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* Sidebar: financeiro */}
      <aside className="space-y-4">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <header className="mb-3 flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <h3 className="text-base font-bold text-foreground">
              Resumo financeiro
            </h3>
          </header>
          <dl className="space-y-1.5 text-sm">
            <Row label="Valor bruto" value={formatBRL(sale.financial.gross)} />
            <Row
              label="Taxa da plataforma"
              value={`- ${formatBRL(sale.financial.platformFee)}`}
            />
            {sale.financial.planLabel && (
              <Row label="Plano" value={sale.financial.planLabel} muted />
            )}
            {sale.financial.litMaxFee !== undefined && (
              <Row
                label="LIT-MAX"
                value={`- ${formatBRL(sale.financial.litMaxFee)}`}
              />
            )}
            {sale.financial.litProtectionFee !== undefined && (
              <Row
                label="Proteção LIT"
                value={`- ${formatBRL(sale.financial.litProtectionFee)}`}
              />
            )}
            <Separator className="my-2" />
            <Row
              label="Líquido estimado"
              value={formatBRL(sale.financial.net)}
              bold
            />
            <Row
              label="Saldo pendente"
              value={formatBRL(sale.financial.pending)}
              muted
            />
            {sale.financial.blockedInDispute > 0 && (
              <>
                <Row
                  label="Saldo bloqueado em mediação"
                  value={formatBRL(sale.financial.blockedInDispute)}
                />
                <p className="text-[11px] text-warning">
                  Motivo: mediação aberta pelo comprador (mock). Nenhum saldo
                  real é bloqueado nesta demonstração.
                </p>
              </>
            )}
            {sale.financial.expectedReleaseAt && (
              <Row
                label="Liberação prevista"
                value={new Date(
                  sale.financial.expectedReleaseAt,
                ).toLocaleDateString("pt-BR")}
                muted
              />
            )}
          </dl>
          {sale.financial.sellerLevelHint && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              {sale.financial.sellerLevelHint}
            </p>
          )}
        </section>

        <div className="rounded-2xl border border-border bg-card p-4 text-[11px] text-muted-foreground">
          Nenhum saldo real é liberado. Confirmação e liberação exigem backend
          seguro.
        </div>
      </aside>

      <OrderProblemDialog
        orderId={sale.orderId}
        open={problemOpen}
        onOpenChange={setProblemOpen}
        perspective="seller"
      />
    </div>
  );
}

function Info({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-foreground">{children}</dd>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className={muted ? "text-xs text-muted-foreground" : "text-sm"}>
        {label}
      </dt>
      <dd
        className={
          (bold ? "text-base font-bold " : "text-sm ") +
          (muted ? "text-muted-foreground" : "text-foreground")
        }
      >
        {value}
      </dd>
    </div>
  );
}
