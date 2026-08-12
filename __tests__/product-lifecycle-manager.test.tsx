import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
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
  it("shows loading while the real product is pending", () => {
    vi.mocked(productLifecycleService.get).mockReturnValue(new Promise(() => undefined));
    render(<ProductLifecycleManager productId={id} />);
    expect(screen.getByText("Carregando produto…")).toBeInTheDocument();
  });
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
  it("explains that activation requires public-catalog eligibility", async () => {
    vi.mocked(productLifecycleService.get).mockResolvedValue(state("UNPUBLISHED"));
    render(<ProductLifecycleManager productId={id} />);
    expect(await screen.findByText(/backend só aceita a ativação/i)).toHaveTextContent(
      /elegível para o catálogo público/i,
    );
  });
  it("communicates that an ACTIVE product is eligible for the public catalog", async () => {
    vi.mocked(productLifecycleService.get).mockResolvedValue(state("ACTIVE"));
    render(<ProductLifecycleManager productId={id} />);
    expect(await screen.findByText(/produto ativo e elegível/i)).toHaveTextContent(
      /catálogo público/i,
    );
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
    expect(screen.getByRole("button", { name: "Remover" })).toBeDisabled();
  });
  it("offers retry after loading error", async () => {
    vi.mocked(productLifecycleService.get).mockRejectedValue(new Error("offline"));
    render(<ProductLifecycleManager productId={id} />);
    expect(await screen.findByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
  });
  it("cancels removal without calling the backend", async () => {
    vi.mocked(productLifecycleService.get).mockResolvedValue(state("ACTIVE"));
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<ProductLifecycleManager productId={id} />);
    fireEvent.click(await screen.findByRole("button", { name: "Remover" }));
    expect(productLifecycleService.transition).not.toHaveBeenCalled();
  });
  it("reloads after a version conflict without a success toast", async () => {
    vi.mocked(productLifecycleService.get)
      .mockResolvedValueOnce(state("ACTIVE"))
      .mockResolvedValueOnce(state("PAUSED", 2));
    vi.mocked(productLifecycleService.transition).mockRejectedValue({
      code: "PRODUCT_VERSION_CONFLICT",
    });
    render(<ProductLifecycleManager productId={id} />);
    fireEvent.click(await screen.findByRole("button", { name: "Pausar" }));
    expect(await screen.findByRole("button", { name: "Retomar" })).toBeInTheDocument();
    expect(productLifecycleService.get).toHaveBeenCalledTimes(2);
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/outra sessão/i));
  });
  it.each([
    ["UNPUBLISHED", "Ativar produto", "ACTIVATE", "ACTIVE"],
    ["ACTIVE", "Pausar", "PAUSE", "PAUSED"],
    ["PAUSED", "Retomar", "RESUME", "ACTIVE"],
  ] as const)("reloads after %s mutation", async (from, button, action, to) => {
    vi.mocked(productLifecycleService.get)
      .mockResolvedValueOnce(state(from))
      .mockResolvedValueOnce(state(to, 2));
    vi.mocked(productLifecycleService.transition).mockResolvedValue({
      ...state(to, 2),
      changed: true,
    });
    render(<ProductLifecycleManager productId={id} />);
    fireEvent.click(await screen.findByRole("button", { name: button }));
    await waitFor(() => expect(productLifecycleService.get).toHaveBeenCalledTimes(2));
    expect(productLifecycleService.transition).toHaveBeenCalledWith(id, action, 1);
  });
  it("maps eligibility failure to a safe Portuguese message", async () => {
    vi.mocked(productLifecycleService.get).mockResolvedValue(state("UNPUBLISHED"));
    vi.mocked(productLifecycleService.transition).mockRejectedValue({
      code: "PRODUCT_READY_COVER_REQUIRED",
      message: "internal prisma stack",
    });
    render(<ProductLifecycleManager productId={id} />);
    fireEvent.click(await screen.findByRole("button", { name: "Ativar produto" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Adicione uma imagem pronta e defina uma única capa.",
      ),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });
});
