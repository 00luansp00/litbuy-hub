import { EmptyState } from "@/components/common/EmptyState";

export function EmptyCartState() {
  return (
    <div className="grid gap-4">
      <EmptyState
        icon="ShoppingCart"
        title="Seu carrinho está vazio"
        description="Explore o marketplace da LIT Buy e encontre contas, gift cards, moedas, skins e serviços com pagamento protegido."
        action={{ label: "Explorar produtos", to: "/" }}
      />
      <div className="flex justify-center">
        <a
          href="/#categorias"
          className="text-sm text-muted-foreground hover:text-primary"
        >
          ou ver todas as categorias
        </a>
      </div>
    </div>
  );
}
