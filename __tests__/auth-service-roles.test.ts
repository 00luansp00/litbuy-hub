import { describe, expect, it } from "vitest";
import { parseAuthMe } from "@/services/auth/authService";

const base = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "user@example.com",
  emailVerified: true,
  phoneVerified: false,
  birthDate: "2000-01-01",
  status: "ACTIVE",
  createdAt: "2026-01-01T00:00:00.000Z",
  roles: ["buyer"],
};

describe("auth role parsing", () => {
  it("deduplicates and orders valid roles", () => {
    expect(parseAuthMe({ ...base, roles: ["admin", "buyer", "seller", "buyer"] }).roles).toEqual([
      "buyer",
      "seller",
      "admin",
    ]);
  });
  it("drops unknown roles safely", () => {
    expect(
      parseAuthMe({ ...base, roles: ["buyer", "owner"] as unknown as ["buyer"] }).roles,
    ).toEqual(["buyer"]);
  });
  it("rejects missing roles as malformed", () => {
    expect(() => parseAuthMe({ ...base, roles: undefined as unknown as ["buyer"] })).toThrow(
      "malformada",
    );
  });
});
