import { describe, expect, it } from "vitest";
import { resolveApiBaseUrl } from "../src/lib/api/client";

const publicUrl = "http://localhost:13001/api/v1";
const internalUrl = "http://backend:3001/api/v1";

describe("API base URL resolution", () => {
  it("uses the public VITE API base in the browser", () => {
    expect(resolveApiBaseUrl({ isServer: false, publicApiBaseUrl: publicUrl })).toBe(publicUrl);
  });

  it("uses the server-only internal API base during SSR", () => {
    expect(
      resolveApiBaseUrl({
        isServer: true,
        internalApiBaseUrl: internalUrl,
        publicApiBaseUrl: publicUrl,
      }),
    ).toBe(internalUrl);
  });

  it("never lets the internal API base replace the browser URL", () => {
    expect(
      resolveApiBaseUrl({
        isServer: false,
        internalApiBaseUrl: internalUrl,
        publicApiBaseUrl: publicUrl,
      }),
    ).toBe(publicUrl);
  });

  it("preserves the existing non-Compose fallback", () => {
    expect(
      resolveApiBaseUrl({
        isServer: true,
        internalApiBaseUrl: "",
        publicApiBaseUrl: publicUrl,
      }),
    ).toBe(publicUrl);
    expect(
      resolveApiBaseUrl({
        isServer: true,
        internalApiBaseUrl: "",
        publicApiBaseUrl: "",
        isDevelopment: true,
        mode: "development",
      }),
    ).toBe("http://localhost:3001/api/v1");
  });
});
