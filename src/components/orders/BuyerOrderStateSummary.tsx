import {
  disputeState,
  fulfillmentState,
  orderState,
  paymentState,
  type BuyerOrder,
} from "@/services/orders";
export function BuyerOrderStateSummary({ order }: { order: BuyerOrder }) {
  const states = [
    ["Pedido", ...orderState[order.status]],
    ["Pagamento", ...paymentState[order.paymentStatus]],
    ["Entrega", ...fulfillmentState[order.fulfillmentStatus]],
    ["Disputa", ...disputeState[order.disputeStatus]],
  ] as const;
  return (
    <section aria-labelledby="states-title">
      <h2 id="states-title" className="text-xl font-bold">
        Estados
      </h2>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        {states.map(([kind, label, description]) => (
          <div key={kind} className="rounded-xl border p-4">
            <dt className="text-xs font-medium uppercase text-muted-foreground">{kind}</dt>
            <dd className="mt-1 font-semibold">{label}</dd>
            <dd className="mt-1 text-sm text-muted-foreground">{description}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
