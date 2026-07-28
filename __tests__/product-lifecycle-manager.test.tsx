import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductLifecycleManager } from "@/components/seller-dashboard/ProductLifecycleManager";
import { productLifecycleService, type ProductStatus } from "@/services/productLifecycleService";

vi.mock("@/services/productLifecycleService", async (original) => ({
  ...(await original<typeof import("@/services/productLifecycleService")>()),
  productLifecycleService: { get: vi.fn(), transition: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const id = "8bc72aa9-1de9-4e97-a578-c151c9e68f45";
const state = (status: ProductStatus, version = 1) => ({
  id,
  slug: "produto-real",
  status,
  version,
  updatedAt: "2026-07-28T12:00:00.000Z",
});
describe("ProductLifecycleManager", () => {
  beforeEach(() => vi.clearAllMocks());
  it.each([
    ["UNPUBLISHED", "Ativar produto"],
    ["ACTIVE", "Pausar"],
    ["PAUSED", "Retomar"],
  ] as const)("shows the valid action for %s", async (status, action) => {
    vi.mocked(productLifecycleService.get).mockResolvedValue(state(status));
    render(<ProductLifecycleManager productId={id} />);
    expect(await screen.findByRole("button", { name: action })).toBeInTheDocument();
  });
  it("shows no mutation for REMOVED", async () => {
    vi.mocked(productLifecycleService.get).mockResolvedValue(state("REMOVED"));
    render(<ProductLifecycleManager productId={id} />);
    expect(await screen.findByText(/remoção é terminal/i)).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
  it("warns that activation does not expose the public catalog", async () => {
    vi.mocked(productLifecycleService.get).mockResolvedValue(state("UNPUBLISHED"));
    render(<ProductLifecycleManager productId={id} />);
    expect(await screen.findByText(/exposição no catálogo público/i)).toBeInTheDocument();
  });
  it("requires removal confirmation and reloads only after backend success", async () => {
    vi.mocked(productLifecycleService.get)
      .mockResolvedValueOnce(state("ACTIVE"))
      .mockResolvedValueOnce(state("REMOVED", 2));
    vi.mocked(productLifecycleService.transition).mockResolvedValue({
      ...state("REMOVED", 2),
      changed: true,
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<ProductLifecycleManager productId={id} />);
    fireEvent.click(await screen.findByRole("button", { name: "Remover" }));
    await waitFor(() =>
      expect(productLifecycleService.transition).toHaveBeenCalledWith(id, "REMOVE", 1),
    );
    expect(window.confirm).toHaveBeenCalled();
    expect(await screen.findByText(/remoção é terminal/i)).toBeInTheDocument();
  });
  it("blocks a double click while a request is pending", async () => {
    vi.mocked(productLifecycleService.get).mockResolvedValue(state("ACTIVE"));
    vi.mocked(productLifecycleService.transition).mockReturnValue(new Promise(() => undefined));
    render(<ProductLifecycleManager productId={id} />);
    const button = await screen.findByRole("button", { name: "Pausar" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(productLifecycleService.transition).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
  });
  it("offers retry after loading error", async () => {
    vi.mocked(productLifecycleService.get).mockRejectedValue(new Error("offline"));
    render(<ProductLifecycleManager productId={id} />);
    expect(await screen.findByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
  });
});
