import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  buildPlan,
  createDefaultRunner,
  defaults,
  executePlan,
  main,
  resolveTargets,
  safeSummary,
  validateLocalTargets,
  type ProcessStep,
} from "../scripts/public-foundation-rehearsal";
const names = (mode: "prepare" | "check" | "ci") => buildPlan(mode).map((s) => s.name);
describe("public foundation rehearsal", () => {
  it("wires the official local rehearsal explicitly to FAKE_ALPHA without a real PSP", () => {
    const root = resolve(import.meta.dirname, "..");
    const compose = readFileSync(resolve(root, "docker-compose.staging.yml"), "utf8");
    const rehearsalEnv = readFileSync(resolve(root, "backend/.env.staging.local.example"), "utf8");

    for (const service of ["migrate", "backend", "demo-data"]) {
      const serviceBlock = compose.split(`  ${service}:`)[1]?.split(/^ {2}[\w-]+:/m)[0];
      expect(serviceBlock).toContain("env_file: ./backend/.env.staging.local.example");
    }
    expect(rehearsalEnv).toMatch(/^PAYMENT_PROVIDER_MODE=FAKE_ALPHA$/m);
    expect(rehearsalEnv).not.toMatch(/^EFI_ENABLED=true$/m);
    expect(rehearsalEnv).not.toMatch(
      /^(EFI_CLIENT_ID|EFI_CLIENT_SECRET|EFI_PIX_MTLS_CERTIFICATE|EFI_PIX_MTLS_PRIVATE_KEY|EFI_PRODUCTION_APPROVED)=/m,
    );
  });
  it("builds the complete plans", () => {
    expect(names("prepare")).toEqual([
      "docker",
      "compose",
      "compose:config",
      "compose:demo-config",
      "compose:up",
      "health:live",
      "health:ready",
      "demo:seed",
      "demo:verify",
      "smoke:home-catalog",
      "smoke:category-catalog",
      "smoke:product-detail-catalog",
    ]);
    expect(names("check")).toEqual([
      "health:live",
      "health:ready",
      "demo:verify",
      "smoke:home-catalog",
      "smoke:category-catalog",
      "smoke:product-detail-catalog",
      "smoke:infra",
    ]);
    expect(names("ci")).toEqual([
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
  it("uses HTTP health steps and never curl", () => {
    for (const mode of ["prepare", "check", "ci"] as const)
      expect(JSON.stringify(buildPlan(mode))).not.toContain("curl");
    for (const mode of ["prepare", "check"] as const)
      expect(buildPlan(mode).filter((s) => s.kind === "http")).toEqual([
        { kind: "http", name: "health:live", url: `${defaults.api}/health/live` },
        { kind: "http", name: "health:ready", url: `${defaults.api}/health/ready` },
      ]);
  });
  it("sets exact infrastructure smoke environment", () => {
    const step = buildPlan("check").at(-1) as ProcessStep;
    expect(step.env).toEqual({
      INFRA_SMOKE_BASE_URL: defaults.api,
      INFRA_SMOKE_ORIGIN: defaults.frontend,
    });
    expect(JSON.stringify(step.env)).not.toMatch(/localhost:(3000|3001)/);
  });
  it("uses fetch and rejects non-2xx", async () => {
    const fetcher = vi.fn(async () => new Response("secret", { status: 503 }));
    const runner = createDefaultRunner(fetcher as typeof fetch);
    await expect(
      executePlan([{ kind: "http", name: "health:ready", url: defaults.api }], runner, () => {}),
    ).rejects.toMatchObject({ exitCode: 1 });
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("stops, preserves exit code, and handles thrown runners", async () => {
    let calls = 0;
    await expect(
      executePlan(
        buildPlan("ci"),
        async () => (++calls === 2 ? 17 : 0),
        () => {},
      ),
    ).rejects.toMatchObject({ exitCode: 17 });
    expect(calls).toBe(2);
    const errors: string[] = [];
    await expect(
      executePlan(
        buildPlan("check"),
        async () => {
          throw new Error("stack secret");
        },
        (x) => errors.push(x),
      ),
    ).rejects.toMatchObject({ exitCode: 1 });
    expect(errors).toEqual(["Falha na etapa: health:live"]);
    expect(errors.join()).not.toContain("secret");
  });
  it("guards CI and displays known target errors", async () => {
    const errors: string[] = [];
    expect(
      await main(
        ["ci"],
        {},
        async () => 0,
        () => {},
        (x) => errors.push(x),
      ),
    ).toBe(2);
    expect(errors).toContain("PUBLIC_FOUNDATION_CI_MODE_REFUSED");
    errors.length = 0;
    expect(
      await main(
        ["check"],
        { NODE_ENV: "production" },
        async () => 0,
        () => {},
        (x) => errors.push(x),
      ),
    ).toBe(1);
    expect(errors).toEqual(["PUBLIC_FOUNDATION_LOCAL_TARGET_REFUSED"]);
  });
  it("reports unknown failures without a stack", async () => {
    const errors: string[] = [];
    expect(
      await main(
        ["check"],
        {},
        async () => {
          throw new Error("secret stack");
        },
        () => {},
        (x) => errors.push(x),
      ),
    ).toBe(1);
    expect(errors).toEqual(["Falha na etapa: health:live"]);
  });
  it("accepts valid loopback URLs and boundary port", () => {
    validateLocalTargets(defaults, {});
    validateLocalTargets({ ...defaults, frontend: "http://127.0.0.1:65535" }, {});
    validateLocalTargets({ ...defaults, frontend: "http://[::1]:13000" }, {});
  });
  it.each([
    "http://localhost:0",
    "http://localhost:65536",
    "http://localhost:13000/path",
    "http://localhost:13000/?query=x",
    "http://localhost:13000/#hash",
    "https://example.com:443",
    "http://user:pass@localhost:13000",
  ])("rejects unsafe frontend %s", (frontend) =>
    expect(() => validateLocalTargets({ ...defaults, frontend }, {})).toThrow(
      "PUBLIC_FOUNDATION_LOCAL_TARGET_REFUSED",
    ),
  );
  it("resolves guarded environment aliases", () => {
    const targets = resolveTargets({
      PUBLIC_FOUNDATION_FRONTEND_URL: "http://127.0.0.1:13000",
      PUBLIC_FOUNDATION_API_URL: "http://[::1]:13001/api/v1",
    });
    expect(targets.frontend).toBe("http://127.0.0.1:13000");
    expect(targets.api).toBe("http://[::1]:13001/api/v1");
  });
  it("returns exact mode-specific safe summaries", () => {
    expect(safeSummary("prepare")).toEqual({
      ok: true,
      mode: "prepare",
      frontend: defaults.frontend,
      api: defaults.api,
      minioConsole: defaults.minioConsole,
      demoDataRemaining: true,
      publicProducts: 6,
      publicSmokes: 3,
    });
    expect(safeSummary("check")).toEqual({
      ok: true,
      mode: "check",
      frontend: defaults.frontend,
      api: defaults.api,
      minioConsole: defaults.minioConsole,
      demoDataRemaining: true,
      verifiedPublicProducts: 6,
      publicSmokes: 3,
      infrastructureSmoke: true,
    });
    expect(safeSummary("ci")).toEqual({
      ok: true,
      mode: "ci",
      frontend: defaults.frontend,
      api: defaults.api,
      minioConsole: defaults.minioConsole,
      publicSmokes: 3,
      secondSeedVerify: true,
      resets: 2,
      demoDataRemaining: false,
    });
    expect(JSON.stringify(safeSummary("ci"))).not.toMatch(
      /token|cookie|pepper|password|publicProducts/i,
    );
  });
});
