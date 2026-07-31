import type { BuyerOrder } from "@/services/orders";
import { BuyerOrderListItem } from "./BuyerOrderListItem";
export function BuyerOrderList({ orders }: { orders: BuyerOrder[] }) {
  return (
    <ul aria-label="Pedidos do comprador" className="space-y-3">
      {orders.map((order) => (
        <BuyerOrderListItem key={order.orderCode} order={order} />
      ))}
    </ul>
  );
}
