import { useState } from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { toast } from "sonner";
import { AuthGate } from "@/components/auth/AuthGate";
import { Breadcrumb } from "@/components/common/Breadcrumb";
import { DigitalDeliveryCard } from "@/components/orders/DigitalDeliveryCard";
import { OrderActionsCard } from "@/components/orders/OrderActionsCard";
import { OrderChatCard } from "@/components/orders/OrderChatCard";
import { OrderDisputeCard } from "@/components/orders/OrderDisputeCard";
import { OrderHeader } from "@/components/orders/OrderHeader";
import { OrderItemsList } from "@/components/orders/OrderItemsList";
import { OrderMediationCard } from "@/components/orders/OrderMediationCard";
import { OrderProblemDialog } from "@/components/orders/OrderProblemDialog";
import { OrderReviewCard } from "@/components/orders/OrderReviewCard";
import { OrderSecurityNotice } from "@/components/orders/OrderSecurityNotice";
import { OrderTimeline } from "@/components/orders/OrderTimeline";
import { EmptyState } from "@/components/common/EmptyState";
import { orderService } from "@/services/orderService";
import { analyticsService } from "@/services/analyticsService";

export const Route = createFileRoute("/pedidos/$id")({
  loader: async ({ params }) => {
    const order = await orderService.getOrderById(params.id);
    if (!order) throw notFound();
    const [timeline, mediation] = await Promise.all([
      orderService.getOrderTimeline(order.id),
      orderService.getOrderMediation(order.id),
    ]);
    return { order, timeline, mediation };
  },
  component: OrderDetailPage,
  notFoundComponent: OrderNotFound,
});

function OrderDetailPage() {
  const { order, timeline, mediation } = Route.useLoaderData();
  const [problemOpen, setProblemOpen] = useState(false);

  const canConfirm =
    order.status === "delivered_by_seller" ||
    order.status === "awaiting_buyer_confirmation";
  const canOpenDispute =
    order.status !== "cancelled" && order.status !== "refunded";

  return (
    <AuthGate
      title="Entre para acessar o pedido"
      description="Você precisa estar logado para ver os detalhes do pedido."
    >
      <div className="container-lit space-y-6 py-6 md:space-y-8 md:py-10">
        <Breadcrumb
          items={[
            { label: "Home", to: "/" },
            { label: "Meus pedidos", to: "/pedidos" },
            { label: order.code },
          ]}
        />

        <OrderHeader order={order} />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
          <div className="min-w-0 space-y-6">
            <OrderItemsList order={order} />
            <DigitalDeliveryCard
              delivery={order.delivery}
              canConfirm={canConfirm}
              onConfirm={() => {
                orderService.simulateConfirmDelivery(order.id);
                analyticsService.track("buyer_confirmed_delivery_mocked", {
                  orderId: order.id,
                });
                toast.success("Recebimento confirmado (mock)", {
                  description:
                    "Em produção, o pagamento seria liberado ao vendedor.",
                });
              }}
              onReport={() => setProblemOpen(true)}
            />
            <OrderChatCard
              order={order}
              onReportProblem={() => setProblemOpen(true)}
            />
            <OrderTimeline events={timeline} />
            {mediation && (
              <OrderMediationCard mediation={mediation} perspective="buyer" />
            )}
            <OrderDisputeCard
              orderId={order.id}
              dispute={order.dispute}
              canOpen={canOpenDispute}
            />
            <OrderReviewCard
              orderId={order.id}
              status={order.status}
              review={order.review}
            />
          </div>

          <aside className="space-y-6">
            <OrderSecurityNotice />
            <OrderActionsCard order={order} />
          </aside>
        </div>
      </div>

      <OrderProblemDialog
        orderId={order.id}
        open={problemOpen}
        onOpenChange={setProblemOpen}
      />
    </AuthGate>
  );
}

function OrderNotFound() {
  return (
    <div className="container-lit py-16">
      <EmptyState
        icon="SearchX"
        title="Pedido não encontrado"
        description="O pedido que você procura não existe ou foi removida."
        action={{ label: "Ver meus pedidos", to: "/pedidos" }}
      />
    </div>
  );
}

