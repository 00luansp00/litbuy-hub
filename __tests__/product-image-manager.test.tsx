import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductImageManager } from "@/components/seller-dashboard/product-images/ProductImageManager";
import { ProductImageConfirmationError, productImageService } from "@/services/productImageService";
vi.mock("@/services/productImageService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/productImageService")>();
  return {
    ...actual,
    productImageService: {
      list: vi.fn(),
      upload: vi.fn(),
      complete: vi.fn(),
      cover: vi.fn(),
      reorder: vi.fn(),
      remove: vi.fn(),
    },
  };
});
const service = vi.mocked(productImageService);
const iso = "2026-07-27T00:00:00.000Z";
const ready = {
  id: "11111111-1111-4111-8111-111111111111",
  status: "READY" as const,
  contentType: "image/png",
  sizeBytes: 1,
  altText: null,
  sortOrder: 0,
  isCover: true,
  uploadedAt: iso,
  createdAt: iso,
  viewUrl: "https://signed.test/image",
  viewExpiresAt: iso,
};
describe("ProductImageManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service.list.mockResolvedValue({ items: [ready], limit: 8 });
    Object.defineProperty(URL, "createObjectURL", {
      value: vi.fn(() => "blob:preview"),
      configurable: true,
    });
    Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), configurable: true });
  });
  it("loads and renders signed images", async () => {
    render(<ProductImageManager productId={ready.id} />);
    expect(await screen.findByRole("img", { name: "Imagem do produto" })).toHaveAttribute(
      "src",
      ready.viewUrl,
    );
  });
  it("does not offer the cover action for a pending image", async () => {
    const pending = {
      ...ready,
      status: "PENDING_UPLOAD" as const,
      isCover: false,
      uploadedAt: null,
      viewUrl: null,
      viewExpiresAt: null,
    };
    service.list.mockResolvedValue({ items: [pending], limit: 8 });
    render(<ProductImageManager productId={ready.id} />);
    expect(await screen.findByText("Upload pendente")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Definir capa" })).not.toBeInTheDocument();
  });
  it("renders a local preview and revokes it after a failed PUT", async () => {
    let rejectUpload!: (error: Error) => void;
    service.upload.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectUpload = reject;
        }),
    );
    render(<ProductImageManager productId={ready.id} />);
    fireEvent.change(screen.getByLabelText("Selecionar imagens"), {
      target: { files: [new File(["x"], "x.png", { type: "image/png" })] },
    });
    expect(await screen.findByRole("img", { name: "Preview local" })).toHaveAttribute(
      "src",
      "blob:preview",
    );
    rejectUpload(new Error("Falha no envio ao storage."));
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview"));
  });
  it("retries only completion while preserving the preview", async () => {
    service.upload.mockRejectedValue(new ProductImageConfirmationError(ready.id));
    service.complete.mockResolvedValue(ready);
    render(<ProductImageManager productId={ready.id} />);
    fireEvent.change(screen.getByLabelText("Selecionar imagens"), {
      target: { files: [new File(["x"], "x.png", { type: "image/png" })] },
    });
    const retry = await screen.findByRole("button", { name: /Tentar confirmar/ });
    expect(screen.getByRole("img", { name: "Preview local" })).toBeInTheDocument();
    fireEvent.click(retry);
    await waitFor(() => expect(service.complete).toHaveBeenCalledTimes(1));
    expect(service.upload).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalled());
  });
  it("restores ordering and reports controlled mutation errors", async () => {
    const second = {
      ...ready,
      id: "22222222-2222-4222-8222-222222222222",
      sortOrder: 1,
      isCover: false,
    };
    service.list.mockResolvedValue({ items: [ready, second], limit: 8 });
    service.reorder.mockRejectedValue(new Error("failure"));
    service.cover.mockRejectedValue(new Error("failure"));
    render(<ProductImageManager productId={ready.id} />);
    await screen.findByText("Imagens do produto (2/8)");
    fireEvent.click(screen.getAllByRole("button", { name: "→" })[0]!);
    expect(await screen.findByText(/ordem anterior foi restaurada/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Definir capa" }));
    expect(await screen.findByText(/Não foi possível definir a capa/)).toBeInTheDocument();
  });
  it("revokes the preview on unmount", async () => {
    service.upload.mockImplementation(() => new Promise(() => undefined));
    const view = render(<ProductImageManager productId={ready.id} />);
    fireEvent.change(screen.getByLabelText("Selecionar imagens"), {
      target: { files: [new File(["x"], "x.png", { type: "image/png" })] },
    });
    await screen.findByRole("img", { name: "Preview local" });
    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
  });
});
