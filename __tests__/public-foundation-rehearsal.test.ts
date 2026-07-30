import { describe, expect, it } from "vitest";
import {
  buildPlan,
  defaults,
  executePlan,
  main,
  safeSummary,
  validateLocalTargets,
} from "../scripts/public-foundation-rehearsal";
describe("public foundation rehearsal", () => {
  it("builds safe plans", () => {
    expect(buildPlan("prepare").map((s) => s.name)).not.toContain("demo:reset");
    expect(buildPlan("check").map((s) => s.name)).not.toContain("demo:seed");
    expect(buildPlan("ci").map((s) => s.name)).toEqual([
      "demo:seed",
      "demo:verify",
      "smoke:home-catalog",
      "smoke:category-catalog",
      "smoke:product-detail-catalog",
      "demo:seed",
      "demo:verify",
      "demo:reset",
      "demo:reset",
    ]);
  });
  it("guards CI", async () => {
    expect(await main(["ci"], {}, async () => 0)).toBe(2);
    expect(await main(["ci"], { CI: "true" }, async () => 0)).toBe(0);
  });
  it("stops and preserves first failure", async () => {
    let calls = 0;
    await expect(
      executePlan(buildPlan("ci"), async () => (++calls === 2 ? 17 : 0)),
    ).rejects.toMatchObject({ exitCode: 17 });
    expect(calls).toBe(2);
  });
  it("accepts loopback targets", () => {
    validateLocalTargets(defaults, {});
    validateLocalTargets({ ...defaults, frontend: "http://127.0.0.1:13000" }, {});
    validateLocalTargets({ ...defaults, frontend: "http://[::1]:13000" }, {});
  });
  it.each([
    "https://example.com:443",
    "http://user:pass@localhost:13000",
    "http://localhost:70000",
  ])("rejects unsafe URL %s", (frontend) =>
    expect(() => validateLocalTargets({ ...defaults, frontend }, {})).toThrow(
      "PUBLIC_FOUNDATION_LOCAL_TARGET_REFUSED",
    ),
  );
  it("rejects an API without prefix and production", () => {
    expect(() =>
      validateLocalTargets({ ...defaults, api: "http://localhost:13001" }, {}),
    ).toThrow();
    expect(() => validateLocalTargets(defaults, { NODE_ENV: "production" })).toThrow();
  });
  it("emits a safe summary", () => {
    const text = JSON.stringify(safeSummary("prepare"));
    expect(text).not.toMatch(/token|cookie|pepper|password/i);
  });
});
