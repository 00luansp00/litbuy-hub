import React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthGate } from "@/components/auth/AuthGate";
import { ApiError } from "@/lib/api/client";
import { OrderDetailContent } from "@/routes/pedidos.$id";
import { BuyerOrderParseError, buyerOrdersService } from "@/services/orders";
import { makeOrder, pending, QueryWrapper } from "./buyer-orders-ui-fixtures";

const auth = vi.hoisted(() => ({ initializing: false, isAuthenticated: true }));
vi.mock("@/providers/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/components/orders/OrderChatCard", () => ({
  OrderChatCard: (props: { orderCode: string; perspective: string; counterpartLabel: string }) => (
    <div data-testid="order-chat">{JSON.stringify(props)}</div>
  ),
}));
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
const renderDetailWithClient = (client: QueryClient) =>
  render(
    <QueryClientProvider client={client}>
      <AuthGate>
        <OrderDetailContent orderCode={code} />
      </AuthGate>
    </QueryClientProvider>,
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
  it("reports through the real API, blocks double submit, and adopts the persisted case", async () => {
    const initial = makeOrder();
    const persisted = makeOrder({
      disputeCases: [
        {
          caseId: "123e4567-e89b-42d3-a456-426614174000",
          status: "OPEN",
          createdAt: "2026-08-30T12:00:00.000Z",
          updatedAt: "2026-08-30T12:00:00.000Z",
          terminalAt: null,
        },
      ],
    });
    vi.spyOn(buyerOrdersService, "detail")
      .mockResolvedValueOnce(initial)
      .mockResolvedValue(persisted);
    let resolve!: (order: typeof persisted) => void;
    const report = vi
      .spyOn(buyerOrdersService, "reportProblem")
      .mockReturnValue(new Promise((done) => (resolve = done)));
    renderDetail();
    const button = await screen.findByRole("button", { name: "Reportar problema" });
    fireEvent.click(button);
    await waitFor(() => expect(report).toHaveBeenCalledTimes(1));
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(report).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Registrando...")).toBeInTheDocument();
    resolve(persisted);
    expect(await screen.findByText("Problema registrado")).toBeInTheDocument();
    expect(screen.getByText("O problema foi registrado com sucesso.")).toBeInTheDocument();
    expect(
      screen.queryByText(/dinheiro será devolvido|pagamento foi bloqueado|refund garantido/i),
    ).not.toBeInTheDocument();
  });
  it("renders an active persisted case after a fresh detail read", async () => {
    vi.spyOn(buyerOrdersService, "detail").mockResolvedValue(
      makeOrder({
        disputeCases: [
          {
            caseId: "123e4567-e89b-42d3-a456-426614174000",
            status: "UNDER_REVIEW",
            createdAt: "2026-08-29T12:00:00.000Z",
            updatedAt: "2026-08-30T12:00:00.000Z",
            terminalAt: null,
          },
        ],
      }),
    );
    renderDetail();
    expect(await screen.findByText("Problema registrado")).toBeInTheDocument();
    expect(screen.getByText(/em análise desde/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reportar problema" })).not.toBeInTheDocument();
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
    expect(screen.getByText("A etapa de entrega ainda não está disponível.")).toBeInTheDocument();
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
  it.each([
    ["BASIC", "299", "R$ 2,99"],
    ["PREMIUM", "499", "R$ 4,99"],
  ] as const)("renders the frozen %s Buyer VIP fee", async (buyerVipPlan, fee, formatted) => {
    vi.spyOn(buyerOrdersService, "detail").mockResolvedValue(
      makeOrder({ buyerVipPlan, buyerVipFeeAmountMinor: fee }),
    );
    renderDetail();
    expect(await screen.findByText("Taxa Buyer VIP")).toBeInTheDocument();
    expect(screen.getByText(formatted)).toBeInTheDocument();
  });
  it.each([
    { fulfillmentStatus: "NOT_AVAILABLE" as const },
    { fulfillmentStatus: "AWAITING_SELLER" as const },
    { fulfillmentStatus: "DELIVERED" as const },
    { fulfillmentStatus: "CONFIRMED" as const, status: "COMPLETED" as const },
    { fulfillmentStatus: "AWAITING_BUYER_CONFIRMATION" as const, disputeStatus: "OPEN" as const },
    {
      fulfillmentStatus: "AWAITING_BUYER_CONFIRMATION" as const,
      disputeStatus: "UNDER_REVIEW" as const,
    },
  ])("does not offer confirmation for an ineligible persisted state", async (state) => {
    vi.spyOn(buyerOrdersService, "detail").mockResolvedValue(
      makeOrder({ status: "ACTIVE", paymentStatus: "PAID", ...state }),
    );
    renderDetail();
    await screen.findByRole("heading", { name: `Pedido ${code}` });
    expect(screen.queryByRole("button", { name: "Confirmar recebimento" })).not.toBeInTheDocument();
  });
  it("confirms through the backend, blocks double submit and adopts persisted completion", async () => {
    const awaiting = makeOrder({
      status: "ACTIVE",
      paymentStatus: "PAID",
      fulfillmentStatus: "AWAITING_BUYER_CONFIRMATION",
    });
    const confirmed = makeOrder({
      status: "COMPLETED",
      paymentStatus: "PAID",
      fulfillmentStatus: "CONFIRMED",
      version: 4,
    });
    vi.spyOn(buyerOrdersService, "detail")
      .mockResolvedValueOnce(awaiting)
      .mockResolvedValue(confirmed);
    let resolveConfirm!: (order: typeof confirmed) => void;
    const confirm = vi.spyOn(buyerOrdersService, "confirmReceipt").mockReturnValue(
      new Promise((resolve) => {
        resolveConfirm = resolve;
      }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    renderDetailWithClient(client);
    const button = await screen.findByRole("button", { name: "Confirmar recebimento" });
    expect(screen.getByText(/somente depois de realmente ter recebido/)).toBeInTheDocument();
    fireEvent.click(button);
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    const pendingButton = screen.getByRole("button", { name: "Confirmando..." });
    expect(pendingButton).toBeDisabled();
    fireEvent.click(pendingButton);
    expect(confirm).toHaveBeenCalledTimes(1);
    resolveConfirm(confirmed);
    expect(await screen.findByText("Pedido concluído")).toBeInTheDocument();
    expect(screen.getByText("Recebimento confirmado")).toBeInTheDocument();
    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ["buyer-order", code] });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ["buyer-orders"] });
    });
  });
  it("keeps the persisted state on confirmation failure and shows a safe error", async () => {
    vi.spyOn(buyerOrdersService, "detail").mockResolvedValue(
      makeOrder({
        status: "ACTIVE",
        paymentStatus: "PAID",
        fulfillmentStatus: "AWAITING_BUYER_CONFIRMATION",
      }),
    );
    vi.spyOn(buyerOrdersService, "confirmReceipt").mockRejectedValue(
      new ApiError(409, "ACTIVE_DISPUTE", "internal dispute data"),
    );
    renderDetail();
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar recebimento" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "O pedido não está disponível para confirmação.",
    );
    expect(screen.getByText("Aguardando confirmação")).toBeInTheDocument();
    expect(screen.queryByText("Pedido concluído")).not.toBeInTheDocument();
    expect(screen.queryByText("internal dispute data")).not.toBeInTheDocument();
    await waitFor(() => expect(buyerOrdersService.confirmReceipt).toHaveBeenCalledTimes(1));
  });
  it("guards the real buyer order path against the legacy mock service", () => {
    for (const relativePath of [
      "src/routes/pedidos.index.tsx",
      "src/routes/pedidos.$id.tsx",
      "src/services/orders/buyerOrdersService.ts",
      "src/services/orders/queries.ts",
    ]) {
      const source = readFileSync(join(process.cwd(), relativePath), "utf8");
      expect(source).not.toMatch(/services\/orderService|simulateConfirmDelivery/);
    }
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
  it.each(["ACTIVE", "COMPLETED"] as const)("mostra chat Buyer para %s + PAID", async (status) => {
    vi.spyOn(buyerOrdersService, "detail").mockResolvedValue(
      makeOrder({ status, paymentStatus: "PAID" }),
    );
    renderDetail();
    expect(await screen.findByTestId("order-chat")).toHaveTextContent(`"orderCode":"${code}"`);
    expect(screen.getByTestId("order-chat")).toHaveTextContent('"perspective":"buyer"');
    expect(screen.getByTestId("order-chat")).toHaveTextContent(
      '"counterpartLabel":"Seller Histórico"',
    );
  });
  it.each([
    { status: "PENDING_PAYMENT" as const, paymentStatus: "PENDING" as const },
    { status: "ACTIVE" as const, paymentStatus: "PROCESSING" as const },
  ])("não mostra chat Buyer para estado inelegível", async (state) => {
    vi.spyOn(buyerOrdersService, "detail").mockResolvedValue(makeOrder(state));
    renderDetail();
    await screen.findByRole("heading", { name: `Pedido ${code}` });
    expect(screen.queryByTestId("order-chat")).not.toBeInTheDocument();
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
