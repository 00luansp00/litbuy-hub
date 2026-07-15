import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch, setAccessToken, ApiError } from "@/lib/api/client";
afterEach(() => {
  vi.restoreAllMocks();
  setAccessToken(null);
  document.cookie = "litbuy_csrf=; Max-Age=0";
});
describe("apiFetch", () => {
  it("uses credentials include and Authorization only with access token", async () => {
    const fetch = vi
      .fn()
      .mockImplementation(() => Promise.resolve(new Response("{}", { status: 200 })));
    vi.stubGlobal("fetch", fetch);
    await apiFetch("/auth/me");
    expect(fetch.mock.calls[0][1].credentials).toBe("include");
    expect(fetch.mock.calls[0][1].headers.get("Authorization")).toBeNull();
    setAccessToken("abc");
    await apiFetch("/auth/me");
    expect(fetch.mock.calls[1][1].headers.get("Authorization")).toBe("Bearer abc");
  });
  it("parses ApiError requestId and empty body", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ code: "INVALID_SESSION", message: "No", requestId: "r1" }),
            { status: 401 },
          ),
        ),
    );
    await expect(
      apiFetch("/auth/refresh", { method: "POST", skipAuthRefresh: true }),
    ).rejects.toMatchObject({ status: 401, code: "INVALID_SESSION", requestId: "r1" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(apiFetch("/empty")).resolves.toBeUndefined();
  });
  it("single-flights three refreshes after 401 and retries once", async () => {
    setAccessToken("old");
    let refresh = 0;
    const fetch = vi.fn(async (url: string) => {
      if (url.endsWith("/auth/refresh")) {
        refresh++;
        return new Response(JSON.stringify({ accessToken: "new" }), { status: 200 });
      }
      if (url.endsWith("/private"))
        return new Response(JSON.stringify({ ok: true }), {
          status:
            fetch.mock.calls.filter((c) => String(c[0]).endsWith("/private")).length <= 3
              ? 401
              : 200,
        });
      return new Response("{}", { status: 200 });
    });
    vi.stubGlobal("fetch", fetch);
    await Promise.all([apiFetch("/private"), apiFetch("/private"), apiFetch("/private")]);
    expect(refresh).toBe(1);
  });
});
