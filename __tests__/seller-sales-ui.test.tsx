import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { Detail } from "@/routes/vendedor.vendas.$id";
import { Sales } from "@/routes/vendedor.vendas.index";
import { sellerSaleKeys, sellerSalesService, type SellerSale } from "@/services/orders";

const router = vi.hoisted(() => ({ search: { page: 1 } as { page?: number }, navigate: vi.fn() }));
vi.mock("@tanstack/react-router", async () => {
  const ReactModule = await import("react");
  return {
    createFileRoute: () => (config: object) => ({
      ...config,
      useSearch: () => router.search,
      useParams: () => ({ id: "LIT-23456789ABCDEF" }),
    }),
    useNavigate: () => router.navigate,
    useRouterState: () => "/vendedor/vendas",
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
        { href: params?.id ? `/vendedor/vendas/${params.id}` : to, ...props },
        children,
      ),
  };
});
const code = "LIT-23456789ABCDEF";
const makeSale = (overrides: Partial<SellerSale> = {}): SellerSale => ({
  orderCode: code,
  currency: "BRL",
  saleAmountMinor: "900719925474099312445",
  status: "ACTIVE",
  paymentStatus: "PAID",
  fulfillmentStatus: "AWAITING_SELLER",
  disputeStatus: "NONE",
  version: 3,
  createdAt: "2026-08-11T00:00:00.000Z",
  updatedAt: "2026-08-11T00:00:00.000Z",
  items: [
    {
      productSlug: "snapshot-real",
      productTitle: "Produto snapshot real",
      variantTitle: null,
      productType: "GAME",
      productModel: "NORMAL",
      deliveryMode: "MANUAL",
      quantity: 1,
      unitAmountMinor: "900719925474099312445",
      lineTotalAmountMinor: "900719925474099312445",
      currency: "BRL",
      serviceEstimatedDelivery: null,
      serviceBuyerRequirements: null,
    },
  ],
  ...overrides,
});
const pending = () => new Promise<never>(() => undefined);
const client = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
const renderWith = (node: React.ReactNode, queryClient = client()) => ({
  queryClient,
  ...render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>),
});

describe("Seller sales list UI", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    router.search = { page: 1 };
    router.navigate.mockReset();
  });
  afterEach(cleanup);
  it("shows loading, error and empty states", async () => {
    vi.spyOn(sellerSalesService, "list").mockReturnValue(pending());
    renderWith(<Sales />);
    expect(screen.getByText("Carregando vendas...")).toBeInTheDocument();
    cleanup();
    vi.spyOn(sellerSalesService, "list").mockRejectedValue(
      new ApiError(403, "FORBIDDEN", "internal"),
    );
    renderWith(<Sales />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar");
    cleanup();
    vi.spyOn(sellerSalesService, "list").mockResolvedValue({ page: 1, limit: 20, items: [] });
    renderWith(<Sales />);
    expect(await screen.findByText("Nenhuma venda encontrada")).toBeInTheDocument();
  });
  it("renders persisted data, navigation and conservative pagination", async () => {
    vi.spyOn(sellerSalesService, "list").mockResolvedValue({
      page: 1,
      limit: 20,
      items: [makeSale()],
    });
    renderWith(<Sales />);
    expect(await screen.findByText(code)).toHaveAttribute("href", `/vendedor/vendas/${code}`);
    expect(screen.getByText("Produto snapshot real")).toBeInTheDocument();
    expect(screen.getByText("R$ 9.007.199.254.740.993.124,45")).toBeInTheDocument();
    expect(screen.getByText(/Pagamento registrado/)).toBeInTheDocument();
    expect(screen.getByText(/Aguardando seller/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Página anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Próxima página" })).toBeDisabled();
  });
  it("changes pages only when a full page enables next", async () => {
    const items = Array.from({ length: 20 }, (_, i) =>
      makeSale({
        orderCode: `LIT-23456789ABCD${String.fromCharCode(65 + Math.floor(i / 8))}${(23456789)[i % 8]}`,
      }),
    );
    vi.spyOn(sellerSalesService, "list").mockResolvedValue({ page: 1, limit: 20, items });
    renderWith(<Sales />);
    const next = await screen.findByRole("button", { name: "Próxima página" });
    expect(next).toBeEnabled();
    fireEvent.click(next);
    expect(router.navigate).toHaveBeenCalledWith({ search: { page: 2 } });
  });
});

describe("Seller sale detail and delivery UI", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(cleanup);
  it("shows loading and an IDOR-safe 404", async () => {
    vi.spyOn(sellerSalesService, "detail").mockReturnValue(pending());
    renderWith(<Detail orderCode={code} />);
    expect(screen.getByText("Carregando venda...")).toBeInTheDocument();
    cleanup();
    vi.spyOn(sellerSalesService, "detail").mockRejectedValue(
      new ApiError(404, "ORDER_NOT_FOUND", "private"),
    );
    renderWith(<Detail orderCode={code} />);
    expect(
      await screen.findByText("Venda não encontrada ou indisponível para esta conta."),
    ).toBeInTheDocument();
    expect(screen.queryByText("private")).not.toBeInTheDocument();
  });
  it("renders persisted states, item snapshots and precise value", async () => {
    vi.spyOn(sellerSalesService, "detail").mockResolvedValue(makeSale());
    renderWith(<Detail orderCode={code} />);
    expect(await screen.findByText("Produto snapshot real")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 9.007.199.254.740.993.124,45").length).toBeGreaterThan(0);
    for (const label of ["Pedido", "Pagamento", "Entrega", "Disputa"])
      expect(screen.getByText(label)).toBeInTheDocument();
  });
  it.each([
    { paymentStatus: "PENDING" as const },
    { fulfillmentStatus: "NOT_AVAILABLE" as const },
    { fulfillmentStatus: "AWAITING_BUYER_CONFIRMATION" as const },
    { fulfillmentStatus: "CONFIRMED" as const },
    { status: "COMPLETED" as const },
    { disputeStatus: "OPEN" as const },
    { disputeStatus: "UNDER_REVIEW" as const },
  ])("hides delivery for every ineligible persisted state", async (state) => {
    vi.spyOn(sellerSalesService, "detail").mockResolvedValue(makeSale(state));
    renderWith(<Detail orderCode={code} />);
    await screen.findByText("Produto snapshot real");
    expect(screen.queryByRole("button", { name: "Marcar como entregue" })).not.toBeInTheDocument();
  });
  it("blocks double submit, has no optimistic success, and adopts the persisted response", async () => {
    const awaiting = makeSale(),
      delivered = makeSale({ fulfillmentStatus: "AWAITING_BUYER_CONFIRMATION", version: 5 });
    vi.spyOn(sellerSalesService, "detail")
      .mockResolvedValueOnce(awaiting)
      .mockResolvedValue(delivered);
    let resolve!: (sale: SellerSale) => void;
    const mark = vi.spyOn(sellerSalesService, "markDelivered").mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const queryClient = client();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    renderWith(<Detail orderCode={code} />, queryClient);
    const button = await screen.findByRole("button", { name: "Marcar como entregue" });
    fireEvent.click(button);
    await waitFor(() => expect(mark).toHaveBeenCalledTimes(1));
    const pendingButton = screen.getByRole("button", { name: "Registrando..." });
    expect(pendingButton).toBeDisabled();
    fireEvent.click(pendingButton);
    expect(mark).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Aguardando confirmação")).not.toBeInTheDocument();
    resolve(delivered);
    expect(await screen.findByText("Aguardando confirmação")).toBeInTheDocument();
    expect(mark).toHaveBeenCalledWith(code);
    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: sellerSaleKeys.detail(code) });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: sellerSaleKeys.all });
    });
  });
  it("keeps persisted state after a failed delivery and does not retry", async () => {
    vi.spyOn(sellerSalesService, "detail").mockResolvedValue(makeSale());
    const mark = vi
      .spyOn(sellerSalesService, "markDelivered")
      .mockRejectedValue(new ApiError(409, "ACTIVE_DISPUTE", "private"));
    renderWith(<Detail orderCode={code} />);
    fireEvent.click(await screen.findByRole("button", { name: "Marcar como entregue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível registrar");
    expect(screen.getByText("Aguardando seller")).toBeInTheDocument();
    expect(screen.queryByText("Aguardando confirmação")).not.toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 20));
    expect(mark).toHaveBeenCalledTimes(1);
  });
});
