import { formatBrlMinor, type BuyerOrder } from "@/services/orders";
export function BuyerOrderAmounts({ order }: { order: BuyerOrder }) {
  const rows = [
    ["Subtotal", order.subtotalAmountMinor],
    ["Desconto", order.discountAmountMinor],
    ["Taxa da plataforma", order.platformFeeAmountMinor],
    ["Total", order.totalAmountMinor],
  ];
  return (
    <section aria-labelledby="amounts-title" className="rounded-xl border p-5">
      <h2 id="amounts-title" className="text-xl font-bold">
        Resumo financeiro
      </h2>
      <dl className="mt-4 space-y-2">
        {rows.map(([label, value], i) => (
          <div
            key={label}
            className={`flex justify-between ${i === 3 ? "border-t pt-3 font-bold" : "text-sm"}`}
          >
            <dt>{label}</dt>
            <dd>
              {formatBrlMinor(value)} <span className="sr-only">BRL</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
