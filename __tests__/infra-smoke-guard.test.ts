import { describe, expect, it } from "vitest";

const { validateInfraSmokeTarget } = (await import("../scripts/infra-smoke-guard.mjs")) as {
  validateInfraSmokeTarget: (options: {
    baseUrl: string;
    environment?: string;
    allowRemote?: boolean;
  }) => URL;
};

describe("validateInfraSmokeTarget", () => {
  it("allows localhost rehearsal targets by default", () => {
    expect(validateInfraSmokeTarget({ baseUrl: "http://localhost:3001/api/v1" }).hostname).toBe(
      "localhost",
    );
  });

  it("rejects production and credentialed targets", () => {
    expect(() =>
      validateInfraSmokeTarget({ baseUrl: "https://api.example.test", environment: "production" }),
    ).toThrow(/production/);
    expect(() => validateInfraSmokeTarget({ baseUrl: "https://user:pass@example.test" })).toThrow(
      /credentials/,
    );
  });

  it("requires explicit HTTPS staging opt-in for remote targets", () => {
    expect(() => validateInfraSmokeTarget({ baseUrl: "https://api.example.test" })).toThrow(
      /staging/,
    );
    expect(() =>
      validateInfraSmokeTarget({
        baseUrl: "http://api.example.test",
        environment: "staging",
        allowRemote: true,
      }),
    ).toThrow(/HTTPS/);
    expect(
      validateInfraSmokeTarget({
        baseUrl: "https://api.example.test",
        environment: "staging",
        allowRemote: true,
      }).hostname,
    ).toBe("api.example.test");
  });
});
