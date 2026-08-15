import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { routeTree } from "@/routeTree.gen";
import { SellerSaleListItem } from "@/routes/vendedor.vendas.index";
import type { SellerSale } from "@/services/orders";

const sale: SellerSale = {
  orderCode: "LIT-QKTBRTT2TLXC35",
  currency: "BRL",
  saleAmountMinor: "4990",
  status: "ACTIVE",
  paymentStatus: "PAID",
  fulfillmentStatus: "AWAITING_SELLER",
  disputeStatus: "NONE",
  version: 1,
  createdAt: "2026-08-15T12:00:00.000Z",
  updatedAt: "2026-08-15T12:00:00.000Z",
  items: [
    {
      productSlug: "produto-alpha",
      productTitle: "Produto Alpha",
      variantTitle: null,
      productType: "DIGITAL",
      productModel: "NORMAL",
      deliveryMode: "MANUAL",
      quantity: 1,
      unitAmountMinor: "4990",
      lineTotalAmountMinor: "4990",
      currency: "BRL",
      serviceEstimatedDelivery: null,
      serviceBuyerRequirements: null,
    },
  ],
};

describe("seller sales file-route composition", () => {
  it.each([
    ["/vendedor/vendas", ["__root__", "/vendedor", "/vendedor/vendas/"]],
    [`/vendedor/vendas/${sale.orderCode}`, ["__root__", "/vendedor", "/vendedor/vendas/$id"]],
  ])("matches %s to its exclusive page in the generated route tree", async (href, routeIds) => {
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: [href] }),
      context: { queryClient: undefined as never },
    });

    await router.load();

    expect(router.state.matches.map((match) => match.routeId)).toEqual(routeIds);
  });

  it("uses the real sales-list link to navigate to the detail route", async () => {
    const root = createRootRoute({ component: Outlet });
    const list = createRoute({
      getParentRoute: () => root,
      path: "/vendedor/vendas",
      component: () => (
        <ul>
          <SellerSaleListItem sale={sale} />
        </ul>
      ),
    });
    const detail = createRoute({
      getParentRoute: () => root,
      path: "/vendedor/vendas/$id",
      component: () => <h1>Detalhe da venda</h1>,
    });
    const router = createRouter({
      routeTree: root.addChildren([list, detail]),
      history: createMemoryHistory({ initialEntries: ["/vendedor/vendas"] }),
    });

    render(<RouterProvider router={router} />);
    const link = await screen.findByRole("link", { name: sale.orderCode });
    expect(link.getAttribute("href")).toBe(`/vendedor/vendas/${sale.orderCode}`);

    fireEvent.click(link);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Detalhe da venda" })).toBeTruthy(),
    );
    expect(router.state.location.pathname).toBe(`/vendedor/vendas/${sale.orderCode}`);
  });
});
