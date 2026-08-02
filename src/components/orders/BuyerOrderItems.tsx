import { formatBrlMinor, type BuyerOrderItem } from "@/services/orders";
export function BuyerOrderItems({ items }: { items: BuyerOrderItem[] }) {
  return (
    <section aria-labelledby="items-title">
      <h2 id="items-title" className="text-xl font-bold">
        Itens registrados no pedido
      </h2>
      <ul className="mt-3 space-y-3">
        {items.map((item, index) => (
          <li key={`${item.productSlug}-${index}`} className="rounded-xl border p-5">
            <h3 className="font-semibold">{item.productTitle}</h3>
            <p className="text-xs text-muted-foreground">/{item.productSlug}</p>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Variante</dt>
                <dd>{item.variantTitle ?? "Sem variante"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Tipo / modelo</dt>
                <dd>
                  {item.productType} / {item.productModel}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Modo de entrega</dt>
                <dd>{item.deliveryMode}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Quantidade</dt>
                <dd>{item.quantity}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Valor unitário</dt>
                <dd>{formatBrlMinor(item.unitAmountMinor)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Total da linha</dt>
                <dd>{formatBrlMinor(item.lineTotalAmountMinor)}</dd>
              </div>
              {item.serviceEstimatedDelivery && (
                <div>
                  <dt className="text-muted-foreground">Prazo estimado</dt>
                  <dd>{item.serviceEstimatedDelivery}</dd>
                </div>
              )}
              {item.serviceBuyerRequirements && (
                <div>
                  <dt className="text-muted-foreground">Requisitos do comprador</dt>
                  <dd>{item.serviceBuyerRequirements}</dd>
                </div>
              )}
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}
