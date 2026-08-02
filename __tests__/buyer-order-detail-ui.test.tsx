import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthGate } from "@/components/auth/AuthGate";
import { ApiError } from "@/lib/api/client";
import { OrderDetailContent } from "@/routes/pedidos.$id";
import { BuyerOrderParseError, buyerOrdersService } from "@/services/orders";
import { makeOrder, pending, QueryWrapper } from "./buyer-orders-ui-fixtures";

const auth = vi.hoisted(() => ({ initializing: false, isAuthenticated: true }));
vi.mock("@/providers/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@tanstack/react-router", async () => {
  const ReactModule = await import("react");
  return {
    createFileRoute: () => (config: object) => ({
      ...config,
      useParams: () => ({ id: "LIT-23456789ABCDEF" }),
    }),
    Link: ({
      children,
      to,
      params,
      ...props
    }: {
      children: React.ReactNode;
      to: string;
      params?: { slug?: string };
    }) =>
      ReactModule.createElement(
        "a",
        { href: params?.slug ? `/loja/${params.slug}` : to, ...props },
        children,
      ),
  };
});
const code = "LIT-23456789ABCDEF";
const renderDetail = () =>
  render(
    <QueryWrapper>
      <AuthGate>
        <OrderDetailContent orderCode={code} />
      </AuthGate>
    </QueryWrapper>,
  );
describe("/pedidos/$id real UI", () => {
  beforeEach(() => {
    auth.initializing = false;
    auth.isAuthenticated = true;
    vi.restoreAllMocks();
  });
  afterEach(cleanup);
  it("does not query before authentication", () => {
    const call = vi.spyOn(buyerOrdersService, "detail");
    auth.initializing = true;
    const view = renderDetail();
    expect(screen.getByText(/Carregando sessão segura/)).toBeInTheDocument();
    expect(call).not.toHaveBeenCalled();
    view.unmount();
    auth.initializing = false;
    auth.isAuthenticated = false;
    renderDetail();
    expect(screen.getByRole("heading", { name: /Entre para acessar/ })).toBeInTheDocument();
    expect(call).not.toHaveBeenCalled();
  });
  it("shows accessible loading", () => {
    vi.spyOn(buyerOrdersService, "detail").mockReturnValue(pending());
    renderDetail();
    expect(screen.getByText("Carregando pedido...")).toBeInTheDocument();
  });
  it("renders historical snapshots, exact states and precise money without mock actions", async () => {
    vi.spyOn(buyerOrdersService, "detail").mockResolvedValue(makeOrder());
    renderDetail();
    expect(await screen.findByRole("heading", { name: `Pedido ${code}` })).toBeInTheDocument();
    expect(screen.getByText("Seller Histórico")).toBeInTheDocument();
    expect(screen.getByText("Produto histórico")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 9.007.199.254.740.993.124,45").length).toBeGreaterThan(0);
    for (const state of ["Pedido", "Pagamento", "Entrega", "Disputa"])
      expect(screen.getAllByText(state).length).toBeGreaterThan(0);
    expect(
      screen.getByText("A etapa de pagamento ainda não foi disponibilizada."),
    ).toBeInTheDocument();
    expect(screen.getByText("Entrega ainda não disponível.")).toBeInTheDocument();
    for (const text of [
      "Pagar",
      "Confirmar recebimento",
      "Abrir disputa",
      "Conversar com vendedor",
      "Pagamento confirmado",
      "Pix",
      "boleto",
      "cartão",
      "entrega simulada",
      "chat",
      "timeline",
      "mediação",
      "avaliação",
      "Proteção LIT",
    ])
      expect(screen.queryByText(new RegExp(text, "i"))).not.toBeInTheDocument();
  });
  it("renders cancelled and expired timestamps from the response", async () => {
    vi.spyOn(buyerOrdersService, "detail").mockResolvedValue(
      makeOrder({
        status: "CANCELLED",
        cancelledAt: "2026-07-31T01:00:00.000Z",
        expiredAt: "2026-07-31T00:30:00.000Z",
      }),
    );
    renderDetail();
    expect(await screen.findByText(/Cancelado em/)).toBeInTheDocument();
    expect(screen.getByText(/Expirado em/)).toBeInTheDocument();
  });
  it("uses an IDOR-safe 404 state without retry", async () => {
    vi.spyOn(buyerOrdersService, "detail").mockRejectedValue(
      new ApiError(404, "ORDER_NOT_FOUND", "internal"),
    );
    renderDetail();
    expect(
      await screen.findByText("Pedido não encontrado ou indisponível para esta conta."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar para Meus pedidos" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tentar novamente" })).not.toBeInTheDocument();
    expect(screen.queryByText("internal")).not.toBeInTheDocument();
  });
  it("shows a safe malformed-response error and retries transient failures", async () => {
    const call = vi
      .spyOn(buyerOrdersService, "detail")
      .mockRejectedValueOnce(new BuyerOrderParseError())
      .mockResolvedValue(makeOrder());
    renderDetail();
    expect(
      await screen.findByText("Não foi possível carregar o pedido com segurança."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(call).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("heading", { name: `Pedido ${code}` })).toBeInTheDocument();
  });
});
