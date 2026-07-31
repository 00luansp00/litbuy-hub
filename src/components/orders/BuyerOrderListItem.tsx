import { Link } from "@tanstack/react-router";
import { Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatBrlMinor, formatOrderDate, paymentState, type BuyerOrder } from "@/services/orders";
import { BuyerOrderStatusBadge } from "./BuyerOrderStatusBadge";
export function BuyerOrderListItem({ order }: { order: BuyerOrder }) {
  const first = order.items[0];
  return (
    <li>
      <Card>
        <CardContent className="flex gap-4 p-5">
          <div
            aria-hidden="true"
            className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-muted"
          >
            <Package />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap justify-between gap-2">
              <Link
                to="/pedidos/$id"
                params={{ id: order.orderCode }}
                className="font-semibold text-primary hover:underline"
                aria-label={`Ver detalhes do pedido ${order.orderCode}`}
              >
                {order.orderCode}
              </Link>
              <strong>{formatBrlMinor(order.totalAmountMinor)}</strong>
            </div>
            <p className="truncate text-sm">
              {first.productTitle}
              {order.items.length > 1 ? ` e mais ${order.items.length - 1} item(ns)` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              Seller registrado: {order.seller.storeName} · {formatOrderDate(order.createdAt)}
            </p>
            <div className="flex flex-wrap gap-2">
              <BuyerOrderStatusBadge status={order.status} />
              <span className="text-xs">Pagamento: {paymentState[order.paymentStatus][0]}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </li>
  );
}
