import { Link } from "@tanstack/react-router";
import { MessageSquare, Receipt, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
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
      </div>
    </section>
  );
}
