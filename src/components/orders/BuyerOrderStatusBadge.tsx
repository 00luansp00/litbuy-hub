import { Badge } from "@/components/ui/badge";
import { orderState, type OrderStatus } from "@/services/orders";
export function BuyerOrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant="outline">Status do pedido: {orderState[status][0]}</Badge>;
}
