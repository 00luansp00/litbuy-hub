import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const finance = vi.hoisted(() => ({
  summary: {} as Record<string, unknown>,
  activity: {} as Record<string, unknown>,
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: object) => config,
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock("@/services/finance/sellerFinance", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/finance/sellerFinance")>();
  return {
    ...actual,
    useSellerFinanceSummary: () => finance.summary,
    useSellerFinanceActivity: () => finance.activity,
  };
});
vi.mock("@/components/seller-dashboard/SellerDashboardLayout", () => ({
  SellerDashboardLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/services/sellerDashboardService", () => ({
  sellerDashboardService: {
    getSellerDashboardSummary: vi.fn().mockResolvedValue({ metrics: [] }),
    getSellerRecentSales: vi.fn().mockResolvedValue([]),
    getSellerListings: vi.fn().mockResolvedValue([]),
    getSellerReviews: vi.fn().mockResolvedValue([]),
    getSellerNotifications: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock("@/components/seller-dashboard/SellerMetricCard", () => ({ SellerMetricCard: () => null }));
vi.mock("@/components/seller-dashboard/SellerRecentSalesCard", () => ({
  SellerRecentSalesCard: () => null,
}));
vi.mock("@/components/seller-dashboard/SellerReviewsCard", () => ({
  SellerReviewsCard: () => null,
}));
vi.mock("@/components/seller-dashboard/SellerNotificationsCard", () => ({
  SellerNotificationsCard: () => null,
}));
vi.mock("@/components/seller-dashboard/SellerQuickActions", () => ({
  SellerQuickActions: () => null,
}));
vi.mock("@/components/seller-dashboard/SellerPerformanceCard", () => ({
  SellerPerformanceCard: () => null,
}));
vi.mock("@/components/seller-dashboard/SellerOnboardingCard", () => ({
  SellerOnboardingCard: () => null,
}));
vi.mock("@/components/seller-dashboard/SellerLevelCard", () => ({ SellerLevelCard: () => null }));
vi.mock("@/components/verification/VerificationStatusCard", () => ({
  VerificationStatusCard: () => null,
}));

import { FinanceiroPage } from "@/routes/vendedor.financeiro";
import { VendedorDashboard } from "@/routes/vendedor.index";

const zero = {
  pendingMinor: "0",
  heldMinor: "0",
  availableMinor: "0",
  reservedMinor: "0",
  deficitMinor: "0",
};
const summary = (balances = zero) => ({
  isPending: false,
  isError: false,
  data: { currency: "BRL", balances },
});
const activity = (overrides: Record<string, unknown> = {}) => ({
  isPending: false,
  isError: false,
  data: { pages: [{ items: [], nextCursor: null }] },
  hasNextPage: false,
  isFetchingNextPage: false,
  isFetchNextPageError: false,
  fetchNextPage: vi.fn(),
  ...overrides,
});
const item = (type: string, movements: typeof zero) => ({
  id: `${type}-id`,
  type,
  referenceType: "ORDER",
  referenceId: "internal",
  createdAt: "2026-08-12T00:00:00.000Z",
  currency: "BRL",
  movements,
});

describe("Seller finance page", () => {
  beforeEach(() => {
    finance.summary = summary();
    finance.activity = activity();
  });
  afterEach(cleanup);

  it("renders independent loading and safe initial errors", () => {
    finance.summary = { isPending: true };
    finance.activity = { isPending: true };
    const view = render(<FinanceiroPage />);
    expect(screen.getByLabelText("Carregando saldos")).toBeInTheDocument();
    expect(screen.getByText("Carregando movimentações…")).toBeInTheDocument();
    view.unmount();
    finance.summary = { isPending: false, isError: true };
    finance.activity = { isPending: false, isError: true };
    render(<FinanceiroPage />);
    expect(
      screen.getByText("Não foi possível carregar os saldos financeiros."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Não foi possível carregar a atividade financeira."),
    ).toBeInTheDocument();
  });

  it("renders all real buckets, exact BigInt precision and safe Alpha copy", () => {
    finance.summary = summary({
      pendingMinor: "100",
      heldMinor: "200",
      availableMinor: "900719925474099300",
      reservedMinor: "400",
      deficitMinor: "500",
    });
    render(<FinanceiroPage />);
    for (const label of [
      "Pendente",
      "Em proteção",
      "Disponível internamente",
      "Reservado",
      "Déficit",
    ])
      expect(screen.getByText(label)).toBeInTheDocument();
    for (const value of ["R$ 1,00", "R$ 2,00", "R$ 9.007.199.254.740.993,00", "R$ 4,00", "R$ 5,00"])
      expect(screen.getByText(value)).toBeInTheDocument();
    expect(screen.getByText(/saldos internos do Alpha/)).toHaveTextContent(
      "não representam saque ou payout habilitado",
    );
    expect(screen.queryByRole("button", { name: "Solicitar saque" })).not.toBeInTheDocument();
    expect(screen.queryByText("Pix")).not.toBeInTheDocument();
    expect(screen.queryByText("Histórico de repasses")).not.toBeInTheDocument();
    expect(screen.queryByText("Demo")).not.toBeInTheDocument();
  });

  it("renders empty activity", () => {
    render(<FinanceiroPage />);
    expect(screen.getByText("Nenhuma movimentação financeira registrada.")).toBeInTheDocument();
  });

  it("renders known activities by non-zero bucket without a fabricated net value", () => {
    const items = [
      item("SALE_RECOGNIZED", { ...zero, pendingMinor: "1200" }),
      item("SELLER_FUNDS_HELD", { ...zero, pendingMinor: "-9000", heldMinor: "9000" }),
      item("SELLER_FUNDS_RELEASED", { ...zero, heldMinor: "-9000", availableMinor: "9000" }),
      item("UNKNOWN_TYPE", { ...zero, reservedMinor: "100" }),
    ];
    finance.activity = activity({ data: { pages: [{ items, nextCursor: null }] } });
    render(<FinanceiroPage />);
    expect(screen.getByText("Venda reconhecida")).toBeInTheDocument();
    expect(
      within(screen.getByText("Venda reconhecida").closest("li")!).getByText("+R$ 12,00"),
    ).toBeInTheDocument();
    const held = screen.getByText("Valor movido para proteção").closest("li")!;
    expect(within(held).getByText("-R$ 90,00")).toBeInTheDocument();
    expect(within(held).getByText("+R$ 90,00")).toBeInTheDocument();
    const released = screen.getByText("Valor liberado internamente").closest("li")!;
    expect(within(released).getByText("-R$ 90,00")).toBeInTheDocument();
    expect(within(released).getByText("+R$ 90,00")).toBeInTheDocument();
    expect(screen.getByText("Movimentação financeira")).toBeInTheDocument();
    expect(within(screen.getByRole("list")).queryByText("R$ 0,00")).not.toBeInTheDocument();
  });

  it("loads opaque next pages and exposes progress only while available", () => {
    const fetchNextPage = vi.fn();
    finance.activity = activity({ hasNextPage: true, fetchNextPage });
    const view = render(<FinanceiroPage />);
    fireEvent.click(screen.getByRole("button", { name: "Carregar mais" }));
    expect(fetchNextPage).toHaveBeenCalledOnce();
    view.unmount();
    finance.activity = activity({ hasNextPage: true, isFetchingNextPage: true });
    render(<FinanceiroPage />);
    expect(screen.getByRole("button", { name: "Carregando…" })).toBeDisabled();
    cleanup();
    finance.activity = activity({ hasNextPage: false });
    render(<FinanceiroPage />);
    expect(screen.queryByRole("button", { name: "Carregar mais" })).not.toBeInTheDocument();
  });

  it("keeps persisted activity visible when another page fails", () => {
    finance.activity = activity({
      data: {
        pages: [
          {
            items: [item("SALE_RECOGNIZED", { ...zero, pendingMinor: "100" })],
            nextCursor: "opaque",
          },
        ],
      },
      hasNextPage: true,
      isFetchNextPageError: true,
    });
    render(<FinanceiroPage />);
    expect(screen.getByText("Venda reconhecida")).toBeInTheDocument();
    expect(screen.getByText("Não foi possível carregar mais movimentações.")).toBeInTheDocument();
  });
});

describe("Seller overview finance", () => {
  afterEach(cleanup);
  it("renders the shared real read model without a withdrawal action", () => {
    finance.summary = summary({ ...zero, availableMinor: "300" });
    render(<VendedorDashboard />);
    expect(screen.getByText("Disponível internamente")).toBeInTheDocument();
    expect(screen.getByText("R$ 3,00")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Solicitar saque" })).not.toBeInTheDocument();
  });
});
