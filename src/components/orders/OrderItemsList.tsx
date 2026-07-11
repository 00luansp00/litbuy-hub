import { Link } from "@tanstack/react-router";
import { formatBRL } from "@/lib/format";
import type { Order, OrderSellerRef } from "@/types";

export function OrderItemsList({ order }: { order: Order }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card md:p-6">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Itens do pedido</h2>
          <p className="text-xs text-muted-foreground">
            Vendido por{" "}
            <SellerLink seller={order.seller} />
          </p>
        </div>
      </header>
      <ul className="divide-y divide-border">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <img
              src={item.productImage}
              alt=""
              aria-hidden
              className="h-14 w-14 shrink-0 rounded-lg border border-border object-cover"
              loading="lazy"
            />
            <div className="min-w-0 flex-1">
              <Link
                to="/produto/$id"
                params={{ id: item.productSlug }}
                className="line-clamp-2 text-sm font-medium text-foreground hover:text-primary"
              >
                {item.productTitle}
              </Link>
              <p className="text-xs text-muted-foreground">
                Qtd: {item.quantity} • {formatBRL(item.unitPrice)}
              </p>
            </div>
            <div className="shrink-0 text-sm font-semibold text-foreground">
              {formatBRL(item.subtotal)}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SellerLink({ seller }: { seller: OrderSellerRef }) {
  if (seller.slug) {
    return (
      <Link
        to="/loja/$slug"
        params={{ slug: seller.slug }}
        className="font-medium text-foreground hover:text-primary"
      >
        {seller.name}
      </Link>
    );
  }
  return <span className="font-medium text-foreground">{seller.name}</span>;
}
