import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentContent } from "@/routes/pagamento.$id";
import { ApiError } from "@/lib/api/client";
import { createInitiationKeyManager } from "@/services/payments";
import { makeOrder } from "./buyer-orders-ui-fixtures";

const mocks = vi.hoisted(() => ({
  order: {} as Record<string, unknown>,
  payment: {} as Record<string, unknown>,
  initiate: vi.fn(),
  confirm: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: object) => ({
    ...config,
    useParams: () => ({ id: "LIT-23456789ABCDEF" }),
  }),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => mocks.navigate,
}));
vi.mock("@/services/orders", async (original) => ({
  ...(await original<typeof import("@/services/orders")>()),
  useBuyerOrder: () => mocks.order,
}));
vi.mock("@/services/payments", async (original) => ({
  ...(await original<typeof import("@/services/payments")>()),
  useBuyerPayment: () => mocks.payment,
  usePaymentActions: () => ({
    initiate: { isPending: false, error: null, mutate: mocks.initiate },
    confirm: { isPending: false, error: null, mutate: mocks.confirm },
  }),
}));
const code = "LIT-23456789ABCDEF";
const query = (data: unknown) => ({
  data,
  isPending: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
});
const payment = (overrides = {}) => ({
  orderCode: code,
  orderStatus: "PENDING_PAYMENT",
  paymentStatus: "NOT_CREATED",
  attemptId: null,
  attemptNumber: null,
  providerCode: null,
  method: null,
  status: null,
  amountMinor: "900719925474099312445",
  currency: "BRL",
  alphaSimulationAvailable: false,
  ...overrides,
});

describe("/pagamento/$id Alpha behavior", () => {
  beforeEach(() => {
    mocks.initiate.mockReset();
    mocks.confirm.mockReset();
    mocks.navigate.mockReset();
    mocks.order = query(makeOrder());
    mocks.payment = query(payment());
  });
  afterEach(cleanup);
  it("renders loading and IDOR-safe not found states", () => {
    mocks.order = { isPending: true };
    mocks.payment = { isPending: true };
    const view = render(<PaymentContent orderCode={code} />);
    expect(screen.getByText("Carregando pagamento...")).toBeInTheDocument();
    view.unmount();
    mocks.order = query(makeOrder());
    mocks.payment = {
      isPending: false,
      isError: true,
      error: new ApiError(404, "ORDER_NOT_FOUND", "hidden"),
      refetch: vi.fn(),
    };
    render(<PaymentContent orderCode={code} />);
    expect(screen.getByText("Pagamento indisponível")).toBeInTheDocument();
  });
  it("shows authoritative money and initiates only an eligible order", () => {
    render(<PaymentContent orderCode={code} />);
    expect(screen.getByText("R$ 9.007.199.254.740.993.124,45")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Iniciar pagamento Alpha" }));
    expect(mocks.initiate).toHaveBeenCalledOnce();
    expect(mocks.initiate.mock.calls[0][0].key).toMatch(/^payment-LIT-/);
  });
  it("shows the blocking attempt and confirms exactly that attempt only when Alpha is available", () => {
    mocks.payment = query(
      payment({
        paymentStatus: "PENDING",
        attemptId: "attempt-7",
        attemptNumber: 1,
        providerCode: "FAKE_ALPHA",
        status: "PENDING",
        alphaSimulationAvailable: true,
      }),
    );
    render(<PaymentContent orderCode={code} />);
    expect(
      screen.queryByRole("button", { name: "Iniciar pagamento Alpha" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Simular aprovação Alpha" }));
    expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ attemptId: "attempt-7" }));
  });
  it.each(["ACTIVE", "EXPIRED", "CANCELLED"])("does not initiate for %s", (status) => {
    mocks.order = query(makeOrder({ status: status as "ACTIVE" }));
    mocks.payment = query(
      payment({ orderStatus: status, paymentStatus: status === "ACTIVE" ? "PAID" : "EXPIRED" }),
    );
    render(<PaymentContent orderCode={code} />);
    expect(
      screen.queryByRole("button", { name: "Iniciar pagamento Alpha" }),
    ).not.toBeInTheDocument();
  });
  it.each(["PENDING", "PROCESSING", "REQUIRES_ACTION"])(
    "não redireciona enquanto tentativa está %s",
    (status) => {
      mocks.payment = query(
        payment({ orderStatus: "PENDING_PAYMENT", paymentStatus: "PENDING", status }),
      );
      render(<PaymentContent orderCode={code} />);
      expect(mocks.navigate).not.toHaveBeenCalled();
    },
  );
  it.each(["ACTIVE", "COMPLETED"])(
    "redireciona %s + PAID pelo orderCode persistido",
    (orderStatus) => {
      mocks.payment = query(payment({ orderCode: code, orderStatus, paymentStatus: "PAID" }));
      render(<PaymentContent orderCode="ignorado-pela-resposta" />);
      expect(mocks.navigate).toHaveBeenCalledWith({
        to: "/pedidos/$id",
        params: { id: code },
        replace: true,
      });
    },
  );
});

describe("initiation intent keys", () => {
  it("reuses a key for one persisted fingerprint and renews it after a terminal attempt", () => {
    let sequence = 0;
    const manager = createInitiationKeyManager(() => `key-${++sequence}`);
    expect(manager({ attemptId: null, status: null })).toBe("key-1");
    expect(manager({ attemptId: null, status: null })).toBe("key-1");
    expect(manager({ attemptId: "attempt-1", status: "FAILED" })).toBe("key-2");
    expect(manager({ attemptId: "attempt-1", status: "FAILED" })).toBe("key-2");
  });
});
