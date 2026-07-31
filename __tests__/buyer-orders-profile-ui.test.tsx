import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthGate } from "@/components/auth/AuthGate";
import { ApiError } from "@/lib/api/client";
import { RecentBuyerOrders } from "@/routes/perfil.index";
import { buyerOrdersService } from "@/services/orders";
import { makeOrder, pending, QueryWrapper } from "./buyer-orders-ui-fixtures";

const auth = vi.hoisted(() => ({ initializing: false, isAuthenticated: true }));
vi.mock("@/providers/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@tanstack/react-router", async () => {
  const ReactModule = await import("react");
  return {
    createFileRoute: () => (config: object) => ({ ...config }),
    Link: ({
      children,
      to,
      params,
      ...props
    }: {
      children: React.ReactNode;
      to: string;
      params?: { id?: string };
    }) =>
      ReactModule.createElement(
        "a",
        { href: params?.id ? `/pedidos/${params.id}` : to, ...props },
        children,
      ),
  };
});
const renderProfileOrders = () =>
  render(
    <QueryWrapper>
      <AuthGate>
        <div>
          <p>Restante do perfil</p>
          <RecentBuyerOrders />
        </div>
      </AuthGate>
    </QueryWrapper>,
  );
describe("/perfil recent buyer orders UI", () => {
  beforeEach(() => {
    auth.initializing = false;
    auth.isAuthenticated = true;
    vi.restoreAllMocks();
  });
  afterEach(cleanup);
  it("waits for authentication and requests exactly five", async () => {
    const call = vi
      .spyOn(buyerOrdersService, "list")
      .mockResolvedValue({ page: 1, limit: 5, items: [] });
    auth.initializing = true;
    const view = renderProfileOrders();
    expect(call).not.toHaveBeenCalled();
    view.unmount();
    auth.initializing = false;
    auth.isAuthenticated = true;
    renderProfileOrders();
    await waitFor(() =>
      expect(call).toHaveBeenCalledWith({ page: 1, limit: 5, status: undefined }),
    );
  });
  it("shows loading then five real links and precise values", async () => {
    vi.spyOn(buyerOrdersService, "list").mockReturnValueOnce(pending());
    const view = renderProfileOrders();
    expect(screen.getByText("Carregando pedidos recentes...")).toBeInTheDocument();
    view.unmount();
    const orders = ["F", "G", "H", "J", "K"].map((last) =>
      makeOrder({ orderCode: `LIT-23456789ABCDE${last}` }),
    );
    vi.spyOn(buyerOrdersService, "list").mockResolvedValue({ page: 1, limit: 5, items: orders });
    renderProfileOrders();
    expect(await screen.findAllByText("R$ 9.007.199.254.740.993.124,45")).toHaveLength(5);
    for (const order of orders)
      expect(screen.getByText(order.orderCode)).toHaveAttribute(
        "href",
        `/pedidos/${order.orderCode}`,
      );
    expect(screen.queryByText("Pedidos realizados")).not.toBeInTheDocument();
    expect(screen.queryByText("Compras concluídas")).not.toBeInTheDocument();
  });
  it("renders an empty state", async () => {
    vi.spyOn(buyerOrdersService, "list").mockResolvedValue({ page: 1, limit: 5, items: [] });
    renderProfileOrders();
    expect(await screen.findByText("Nenhum pedido recente encontrado.")).toBeInTheDocument();
  });
  it("isolates errors, keeps profile content and retries", async () => {
    const call = vi
      .spyOn(buyerOrdersService, "list")
      .mockRejectedValueOnce(new ApiError(403, "FORBIDDEN", "offline"))
      .mockResolvedValue({ page: 1, limit: 5, items: [] });
    renderProfileOrders();
    expect(await screen.findByText("Restante do perfil")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(call).toHaveBeenCalledTimes(2));
    expect(screen.getByText("Restante do perfil")).toBeInTheDocument();
  });
});
