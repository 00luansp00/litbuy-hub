import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth/AuthGate";
import { AccountLayout } from "@/components/account/AccountLayout";
import { AccountHeader } from "@/components/account/AccountHeader";
import { RecentFavoritesCard } from "@/components/account/RecentFavoritesCard";
import { accountService } from "@/services/accountService";
import { productService } from "@/services/productService";
import type { Product } from "@/types";

export const Route = createFileRoute("/favoritos")({
  loader: async () => {
    const [summary, favorites, allProducts] = await Promise.all([
      accountService.getAccountSummary(),
      accountService.getRecentFavorites(12),
      productService.list(),
    ]);
    const map = new Map<string, Product>(allProducts.map((p) => [p.id, p]));
    const products = favorites
      .map((f) => map.get(f.productId))
      .filter((p): p is Product => Boolean(p));
    return { summary, products };
  },
  component: FavoritosPage,
});

function FavoritosPage() {
  const { summary, products } = Route.useLoaderData();
  return (
    <AuthGate>
      <AccountLayout
        header={
          <AccountHeader
            memberSince={summary.memberSince}
            verified={summary.verified}
            level={summary.level}
          />
        }
        title="Favoritos"
        description="Itens salvos por você para acessar rapidamente."
      >
        <RecentFavoritesCard products={products} hideHeader />
      </AccountLayout>
    </AuthGate>
  );
}
