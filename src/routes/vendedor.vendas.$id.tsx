import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth/AuthGate";
import { SellerDashboardLayout } from "@/components/seller-dashboard/SellerDashboardLayout";
import { SellerSaleDetailView } from "@/components/seller-dashboard/sales/SellerSaleDetailView";
import { EmptyState } from "@/components/common/EmptyState";
import { sellerSaleService } from "@/services/sellerSaleService";

export const Route = createFileRoute("/vendedor/vendas/$id")({
  loader: async ({ params }) => {
    const sale = await sellerSaleService.getSellerSaleDetail(params.id);
    if (!sale) throw notFound();
    return { sale };
  },
  component: SellerSaleDetailPage,
  notFoundComponent: SellerSaleNotFound,
  head: () => ({
    meta: [
      { title: "Detalhe da venda — LIT Buy" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function SellerSaleDetailPage() {
  const { sale } = Route.useLoaderData();
  return (
    <AuthGate
      title="Entre para acessar suas vendas"
      description="Você precisa estar logado para ver o detalhe da venda."
    >
      <SellerDashboardLayout
        title={`Venda ${sale.code}`}
        description="Visão do vendedor sobre esta venda — dados mockados."
      >
        <nav className="mb-4 text-xs text-muted-foreground">
          <Link to="/vendedor" className="hover:text-foreground">
            Vendedor
          </Link>{" "}
          ·{" "}
          <Link to="/vendedor/vendas" className="hover:text-foreground">
            Vendas
          </Link>{" "}
          · Detalhe
        </nav>
        <SellerSaleDetailView sale={sale} />
      </SellerDashboardLayout>
    </AuthGate>
  );
}

function SellerSaleNotFound() {
  return (
    <SellerDashboardLayout title="Venda não encontrada">
      <EmptyState
        icon="SearchX"
        title="Venda não encontrada"
        description="A venda que você procura não existe ou foi removida."
        action={{ label: "Ver todas as vendas", to: "/vendedor/vendas" }}
      />
    </SellerDashboardLayout>
  );
}
