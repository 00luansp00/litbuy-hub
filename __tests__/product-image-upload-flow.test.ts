import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api/client";
import { ProductImageConfirmationError, productImageService } from "@/services/productImageService";
vi.mock("@/lib/api/client", () => ({ apiFetch: vi.fn() }));
const mockedFetch = vi.mocked(apiFetch);
const id = "11111111-1111-4111-8111-111111111111";
const iso = "2026-07-27T00:00:00.000Z";
const intent = {
  imageId: id,
  uploadUrl: "https://upload.test/object",
  headers: { "Content-Type": "image/png", "If-None-Match": "*", "X-Signed": "yes" },
  expiresAt: iso,
};
const ready = {
  id,
  status: "READY",
  contentType: "image/png",
  sizeBytes: 1,
  altText: null,
  sortOrder: 0,
  isCover: true,
  uploadedAt: iso,
  createdAt: iso,
  viewUrl: "https://read.test/object",
  viewExpiresAt: iso,
};
class FakeXHR {
  static current: FakeXHR | undefined;
  upload: {
    onprogress?: (event: { lengthComputable: boolean; loaded: number; total: number }) => void;
  } = {};
  onload?: () => void;
  onerror?: () => void;
  status = 200;
  headers: Record<string, string> = {};
  constructor() {
    FakeXHR.current = this;
  }
  open = vi.fn();
  setRequestHeader = (k: string, v: string) => {
    this.headers[k] = v;
  };
  send = vi.fn();
  success() {
    this.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 2 });
    this.onload?.();
  }
  failStatus() {
    this.status = 412;
    this.onload?.();
  }
  network() {
    this.onerror?.();
  }
}
describe("productImageService upload XHR", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    FakeXHR.current = undefined;
    mockedFetch.mockReset();
    vi.stubGlobal("XMLHttpRequest", FakeXHR);
    mockedFetch.mockResolvedValueOnce(intent).mockResolvedValueOnce(ready);
  });
  it("creates intent, forwards every signed header, reports progress and completes on 2xx", async () => {
    const progress = vi.fn();
    const promise = productImageService.upload(
      id,
      new File(["x"], "x.png", { type: "image/png" }),
      progress,
    );
    await vi.waitFor(() => expect(FakeXHR.current).toBeTruthy());
    expect(FakeXHR.current!.headers).toEqual(intent.headers);
    FakeXHR.current!.success();
    await expect(promise).resolves.toMatchObject({ status: "READY" });
    expect(progress).toHaveBeenCalledWith(50);
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });
  it.each(["status", "network"])("does not complete after PUT %s failure", async (mode) => {
    const promise = productImageService.upload(id, new File(["x"], "x.png", { type: "image/png" }));
    await vi.waitFor(() => expect(FakeXHR.current).toBeTruthy());
    if (mode === "status") FakeXHR.current!.failStatus();
    else FakeXHR.current!.network();
    await expect(promise).rejects.toThrow(/storage/);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });
  it("preserves imageId when completion fails", async () => {
    mockedFetch
      .mockReset()
      .mockResolvedValueOnce(intent)
      .mockRejectedValueOnce(new Error("complete"));
    const promise = productImageService.upload(id, new File(["x"], "x.png", { type: "image/png" }));
    await vi.waitFor(() => expect(FakeXHR.current).toBeTruthy());
    FakeXHR.current!.success();
    await expect(promise).rejects.toMatchObject<ProductImageConfirmationError>({ imageId: id });
  });
});
