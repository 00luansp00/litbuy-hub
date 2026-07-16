import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  apiFetch,
  getAccessToken,
  setAccessToken,
  setAuthLostHandler,
} from "@/lib/api/client";

afterEach(() => {
  vi.restoreAllMocks();
  setAccessToken(null);
  setAuthLostHandler(() => {});
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

  it("returns HTTP 202 as a valid body and not an ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ code: "DEVICE_APPROVAL_REQUIRED" }), { status: 202 }),
        ),
    );
    await expect(apiFetch("/auth/login", { method: "POST" })).resolves.toEqual({
      code: "DEVICE_APPROVAL_REQUIRED",
    });
  });

  it("parses ApiError safely, preserves requestId, and ignores extra payload fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              code: "INVALID_SESSION",
              message: ["No"],
              requestId: "r1",
              challengeId: "must-not-copy",
            }),
            { status: 401 },
          ),
        ),
      ),
    );
    await expect(
      apiFetch("/auth/refresh", { method: "POST", skipAuthRefresh: true }),
    ).rejects.toMatchObject({
      status: 401,
      code: "INVALID_SESSION",
      message: "No",
      requestId: "r1",
    });
    try {
      await apiFetch("/auth/refresh", { method: "POST", skipAuthRefresh: true });
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as { challengeId?: string }).challengeId).toBeUndefined();
    }
  });

  it("handles empty and HTML bodies without exposing internal content", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(apiFetch("/empty")).resolves.toBeUndefined();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>secret</html>", { status: 500 })),
    );
    await expect(apiFetch("/broken", { skipAuthRefresh: true })).rejects.toMatchObject({
      message: "Não foi possível concluir a operação.",
    });
  });

  it("decodes a valid CSRF cookie before refresh and logout", async () => {
    document.cookie = "litbuy_csrf=a%20b; path=/";
    const fetch = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({ accessToken: "new" }), { status: 200 })),
      );
    vi.stubGlobal("fetch", fetch);
    await apiFetch("/auth/refresh", { method: "POST", skipAuthRefresh: true });
    expect(fetch.mock.calls[0][1].headers.get("X-CSRF-Token")).toBe("a b");
    await apiFetch("/auth/logout", { method: "POST", skipAuthRefresh: true });
    expect(fetch.mock.calls[1][1].headers.get("X-CSRF-Token")).toBe("a b");
  });

  it("ignores a truly malformed CSRF cookie without crashing or sending it", async () => {
    document.cookie = "litbuy_csrf=%E0%A4%A; path=/";
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ accessToken: "new" }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);

    await expect(
      apiFetch("/auth/refresh", { method: "POST", skipAuthRefresh: true }),
    ).resolves.toEqual({ accessToken: "new" });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1].headers.has("X-CSRF-Token")).toBe(false);
  });

  it("single-flights refresh, retries once, and does not loop on a second 401", async () => {
    setAccessToken("old");
    let refresh = 0;
    const fetch = vi.fn(async (url: string) => {
      if (url.endsWith("/auth/refresh")) {
        refresh += 1;
        return new Response(JSON.stringify({ accessToken: "new" }), { status: 200 });
      }
      if (url.endsWith("/private")) {
        const count = fetch.mock.calls.filter((c) => String(c[0]).endsWith("/private")).length;
        return new Response(JSON.stringify({ ok: count > 3 }), { status: count <= 3 ? 401 : 200 });
      }
      if (url.endsWith("/still-401"))
        return new Response(JSON.stringify({ code: "INVALID_SESSION" }), { status: 401 });
      return new Response("{}", { status: 200 });
    });
    vi.stubGlobal("fetch", fetch);
    await Promise.all([apiFetch("/private"), apiFetch("/private"), apiFetch("/private")]);
    expect(refresh).toBe(1);
    await expect(apiFetch("/still-401")).rejects.toMatchObject({ status: 401 });
    expect(fetch.mock.calls.filter((c) => String(c[0]).endsWith("/still-401"))).toHaveLength(2);
  });

  it.each([
    ["missing", {}],
    ["empty", { accessToken: "" }],
    ["non-string", { accessToken: 123 }],
  ])(
    "clears auth when automatic refresh returns an invalid %s access token",
    async (_name, body) => {
      setAccessToken("old");
      const lost = vi.fn();
      setAuthLostHandler(lost);
      const fetch = vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith("/auth/refresh")) {
          return new Response(JSON.stringify(body), { status: 200 });
        }
        if (url.endsWith("/private")) {
          return new Response(JSON.stringify({ code: "INVALID_SESSION" }), { status: 401 });
        }
        return new Response("{}", { status: 200 });
      });
      vi.stubGlobal("fetch", fetch);

      await expect(apiFetch("/private")).rejects.toMatchObject({ status: 401 });

      expect(getAccessToken()).toBeNull();
      expect(lost).toHaveBeenCalledTimes(1);
      expect(fetch.mock.calls.filter((c) => String(c[0]).endsWith("/private"))).toHaveLength(1);
      expect(
        fetch.mock.calls.some(
          (c) =>
            String(c[0]).endsWith("/private") &&
            c[1]?.headers?.get("Authorization") === "Bearer 123",
        ),
      ).toBe(false);
    },
  );

  it("clears auth when refresh fails", async () => {
    setAccessToken("old");
    const lost = vi.fn();
    setAuthLostHandler(lost);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.endsWith("/auth/refresh")
          ? new Response(JSON.stringify({ code: "INVALID_SESSION" }), { status: 401 })
          : new Response(JSON.stringify({ code: "INVALID_SESSION" }), { status: 401 }),
      ),
    );
    await expect(apiFetch("/private")).rejects.toMatchObject({ status: 401 });
    expect(getAccessToken()).toBeNull();
    expect(lost).toHaveBeenCalled();
  });
});
