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
import { BuyerOrderListItem } from "@/components/orders/BuyerOrderListItem";
import type { BuyerOrder } from "@/services/orders";
import { routeTree } from "@/routeTree.gen";

const order: BuyerOrder = {
  orderCode: "LIT-QKTBRTT2TLXC35",
  seller: { slug: "loja-alpha", storeName: "Loja Alpha" },
  currency: "BRL",
  subtotalAmountMinor: "4990",
  discountAmountMinor: "0",
  platformFeeAmountMinor: "0",
  totalAmountMinor: "4990",
  buyerVipPlan: "NONE",
  buyerVipFeeAmountMinor: "0",
  status: "PENDING_PAYMENT",
  paymentStatus: "NOT_CREATED",
  fulfillmentStatus: "NOT_AVAILABLE",
  disputeStatus: "NONE",
  disputeCases: [],
  version: 1,
  expiresAt: "2026-08-16T12:00:00.000Z",
  cancelledAt: null,
  expiredAt: null,
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

describe("buyer order file-route composition", () => {
  it.each([
    ["/pedidos", ["__root__", "/pedidos/"]],
    [`/pedidos/${order.orderCode}`, ["__root__", "/pedidos/$id"]],
  ])("matches %s to its exclusive page in the generated route tree", async (href, routeIds) => {
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: [href] }),
      context: { queryClient: undefined as never },
    });

    await router.load();

    expect(router.state.matches.map((match) => match.routeId)).toEqual(routeIds);
  });

  it("uses the real list link to reach the detail route", async () => {
    const root = createRootRoute({ component: Outlet });
    const list = createRoute({
      getParentRoute: () => root,
      path: "/pedidos",
      component: () => <BuyerOrderListItem order={order} />,
    });
    const detail = createRoute({
      getParentRoute: () => root,
      path: "/pedidos/$id",
      component: () => <h1>Detalhe do pedido</h1>,
    });
    const router = createRouter({
      routeTree: root.addChildren([list, detail]),
      history: createMemoryHistory({ initialEntries: ["/pedidos"] }),
    });

    render(<RouterProvider router={router} />);
    const link = await screen.findByRole("link", {
      name: `Ver detalhes do pedido ${order.orderCode}`,
    });
    expect(link.getAttribute("href")).toBe(`/pedidos/${order.orderCode}`);

    fireEvent.click(link);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Detalhe do pedido" })).toBeTruthy(),
    );
    expect(router.state.location.pathname).toBe(`/pedidos/${order.orderCode}`);
  });
});
