import { Link } from "@tanstack/react-router";
import { MessageSquare, Receipt, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportButton } from "@/components/report/ReportButton";
import type { Order } from "@/types";

export function OrderActionsCard({ order }: { order: Order }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card md:p-6">
      <header className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">Ações</h2>
        <p className="text-xs text-muted-foreground">
          Atalhos rápidos relacionados ao pedido.
        </p>
      </header>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/mensagens">
            <MessageSquare className="h-4 w-4" /> Falar com o vendedor
          </Link>
        </Button>
        {order.seller.slug && (
          <Button asChild variant="outline" size="sm">
            <Link to="/loja/$slug" params={{ slug: order.seller.slug }}>
              <Store className="h-4 w-4" /> Ver loja
            </Link>
          </Button>
        )}
        <Button asChild variant="ghost" size="sm">
          <Link to="/pedidos">
            <Receipt className="h-4 w-4" /> Meus pedidos
          </Link>
        </Button>
        <ReportButton
          targetType="seller"
          targetId={order.seller.id}
          targetLabel={order.seller.name}
          label="Denunciar vendedor"
          variant="ghost"
          size="sm"
          source="order_page"
          context={{
            orderId: order.id,
            orderCode: order.code,
            sellerId: order.seller.id,
            sellerSlug: order.seller.slug,
          }}
        />
        <ReportButton
          targetType="order"
          targetId={order.id}
          targetLabel={`Pedido ${order.code}`}
          label="Denunciar comportamento"
          variant="ghost"
          size="sm"
          source="order_page"
          context={{
            orderId: order.id,
            orderCode: order.code,
            sellerId: order.seller.id,
          }}
        />
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Problemas de entrega abrem <span className="font-medium">mediação</span>.
        Comportamento irregular, golpe ou contato externo devem ser{" "}
        <span className="font-medium">denunciados</span>.
      </p>
    </section>
  );
}

