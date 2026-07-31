import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthGate } from "@/components/auth/AuthGate";
import { ApiError } from "@/lib/api/client";
import { buyerOrdersService } from "@/services/orders";
import { parseOrderPage, parseOrderStatus, PedidosContent } from "@/routes/pedidos";
import { makeOrder, pending, QueryWrapper } from "./buyer-orders-ui-fixtures";

const state = vi.hoisted(() => ({
  initializing: false,
  isAuthenticated: true,
  search: { page: 1 } as { page?: number; status?: string },
  navigate: vi.fn(),
}));
vi.mock("@/providers/AuthContext", () => ({ useAuth: () => state }));
vi.mock("@tanstack/react-router", async () => {
  const ReactModule = await import("react");
  return {
    createFileRoute: () => (config: object) => ({ ...config, useSearch: () => state.search }),
    useNavigate: () => state.navigate,
    useRouterState: () => "/pedidos",
    Link: ({
      children,
      to,
      params,
      activeProps: _activeProps,
      ...props
    }: {
      children: React.ReactNode;
      to: string;
      params?: { id?: string };
      activeProps?: object;
    }) =>
      ReactModule.createElement(
        "a",
        { href: params?.id ? `/pedidos/${params.id}` : to, ...props },
        children,
      ),
  };
});

const renderPage = () =>
  render(
    <QueryWrapper>
      <AuthGate>
        <PedidosContent />
      </AuthGate>
    </QueryWrapper>,
  );
describe("/pedidos real UI", () => {
  beforeEach(() => {
    state.initializing = false;
    state.isAuthenticated = true;
    state.search = { page: 1 };
    state.navigate.mockReset();
    vi.restoreAllMocks();
  });
  afterEach(cleanup);
  it("normalizes every unsafe URL page", () => {
    for (const value of [
      0,
      -1,
      1.5,
      Infinity,
      10_001,
      Number.MAX_SAFE_INTEGER + 1,
      "999999999999999999999999",
      "texto",
      [],
      {},
    ])
      expect(parseOrderPage(value)).toBe(1);
    expect(parseOrderPage("10000")).toBe(10_000);
  });
  it("does not query while session initializes or is anonymous", () => {
    const call = vi.spyOn(buyerOrdersService, "list");
    state.initializing = true;
    const view = renderPage();
    expect(screen.getByText(/Carregando sessão segura/)).toBeInTheDocument();
    expect(call).not.toHaveBeenCalled();
    view.unmount();
    state.initializing = false;
    state.isAuthenticated = false;
    renderPage();
    expect(screen.getByRole("heading", { name: /Entre para acessar/ })).toBeInTheDocument();
    expect(call).not.toHaveBeenCalled();
  });
  it("shows accessible loading then a real historical list and large money", async () => {
    vi.spyOn(buyerOrdersService, "list").mockReturnValue(pending());
    renderPage();
    expect(screen.getByText("Carregando pedidos...")).toBeInTheDocument();
    cleanup();
    const order = makeOrder({
      items: [...makeOrder().items, { ...makeOrder().items[0], productSlug: "segundo" }],
    });
    vi.spyOn(buyerOrdersService, "list").mockResolvedValue({ page: 1, limit: 20, items: [order] });
    renderPage();
    expect(await screen.findByText(order.orderCode)).toHaveAttribute(
      "href",
      `/pedidos/${order.orderCode}`,
    );
    expect(
      screen.getByText("Seller registrado: Seller Histórico", { exact: false }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Produto histórico e mais 1 item/)).toBeInTheDocument();
    expect(screen.getByText("R$ 9.007.199.254.740.993.124,45")).toBeInTheDocument();
    expect(screen.getByText(/Status do pedido: Pedido criado/)).toBeInTheDocument();
    expect(screen.getByText(/Pagamento: Pagamento não criado/)).toBeInTheDocument();
    expect(document.querySelector("img")).not.toBeInTheDocument();
  });
  it("shows empty and a safe later-page back action", async () => {
    vi.spyOn(buyerOrdersService, "list").mockResolvedValue({ page: 2, limit: 20, items: [] });
    state.search = { page: 2 };
    renderPage();
    const back = await screen.findByRole("button", { name: "Voltar uma página" });
    fireEvent.click(back);
    expect(state.navigate).toHaveBeenCalledWith({ search: { page: 1, status: undefined } });
  });
  it("retries an error with a new request", async () => {
    const call = vi
      .spyOn(buyerOrdersService, "list")
      .mockRejectedValueOnce(new ApiError(403, "FORBIDDEN", "offline"))
      .mockResolvedValue({ page: 1, limit: 20, items: [] });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(call).toHaveBeenCalledTimes(2));
  });
  it("normalizes filters and drives conservative pagination", async () => {
    const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    const items = Array.from({ length: 20 }, (_, index) =>
      makeOrder({ orderCode: `LIT-23456789ABCD${alphabet[0]}${alphabet[index]}` }),
    );
    vi.spyOn(buyerOrdersService, "list").mockResolvedValue({ page: 1, limit: 20, items });
    expect(parseOrderStatus("UNKNOWN")).toBeUndefined();
    expect(parseOrderStatus("ACTIVE")).toBe("ACTIVE");
    state.search = { page: 1 };
    renderPage();
    expect(await screen.findByLabelText(/Status/)).toHaveValue("");
    const next = await screen.findByRole("button", { name: "Próxima página" });
    fireEvent.change(screen.getByLabelText(/Status/), { target: { value: "ACTIVE" } });
    expect(state.navigate).toHaveBeenCalledWith({ search: { page: 1, status: "ACTIVE" } });
    fireEvent.click(next);
    expect(state.navigate).toHaveBeenCalledWith({ search: { page: 2, status: undefined } });
    expect(screen.getByRole("button", { name: "Página anterior" })).toBeDisabled();
  });
  it("disables next when the page is not full", async () => {
    vi.spyOn(buyerOrdersService, "list").mockResolvedValue({
      page: 1,
      limit: 20,
      items: [makeOrder()],
    });
    renderPage();
    expect(await screen.findByRole("button", { name: "Próxima página" })).toBeDisabled();
  });
});
