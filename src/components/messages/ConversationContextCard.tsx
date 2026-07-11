import { Link } from "@tanstack/react-router";
import { HeadphonesIcon, Package, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ConversationContext } from "@/types";

function formatPrice(v?: number) {
  if (v === undefined) return "";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ConversationContextCard({
  context,
}: {
  context: ConversationContext;
}) {
  if (context.type === "support") {
    return (
      <div className="flex items-start gap-3 border-b border-border bg-surface/40 p-3 md:p-4">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <HeadphonesIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            Atendimento LIT Buy
          </p>
          <p className="text-xs text-muted-foreground">
            {context.note ??
              "Suporte oficial da plataforma. Nunca solicitamos senha ou dados de cartão."}
          </p>
        </div>
      </div>
    );
  }

  if (context.type === "order_related" && context.orderCode) {
    return (
      <div className="flex items-center gap-3 border-b border-border bg-surface/40 p-3 md:p-4">
        {context.productImage && (
          <img
            src={context.productImage}
            alt={context.productTitle ?? ""}
            loading="lazy"
            className="h-12 w-12 rounded-lg border border-border object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Sobre o pedido
          </p>
          <p className="truncate text-sm font-medium text-foreground">
            {context.orderCode}
          </p>
          {context.productTitle && (
            <p className="truncate text-xs text-muted-foreground">
              {context.productTitle}
            </p>
          )}
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/pedidos/$id" params={{ id: context.orderId ?? "" }}>
            <Receipt className="h-3.5 w-3.5" /> Ver pedido
          </Link>
        </Button>
      </div>
    );
  }

  // pre_purchase
  if (context.productSlug) {
    return (
      <div className="flex items-center gap-3 border-b border-border bg-surface/40 p-3 md:p-4">
        {context.productImage && (
          <img
            src={context.productImage}
            alt={context.productTitle ?? ""}
            loading="lazy"
            className="h-12 w-12 rounded-lg border border-border object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Sobre o produto
          </p>
          <p className="truncate text-sm font-medium text-foreground">
            {context.productTitle}
          </p>
          {context.productPrice !== undefined && (
            <p className="text-xs text-muted-foreground">
              {formatPrice(context.productPrice)}
            </p>
          )}
        </div>
        <Button asChild size="sm" variant="outline">
          <Link
            to="/produto/$id"
            params={{ id: context.productSlug }}
          >
            <Package className="h-3.5 w-3.5" /> Ver produto
          </Link>
        </Button>
      </div>
    );
  }

  return null;
}
