export type Mode = "prepare" | "check" | "ci";
export type Targets = { frontend: string; api: string; minio: string; minioConsole: string };
export type ProcessStep = {
  kind: "process";
  name: string;
  command: string[];
  env?: Record<string, string>;
};
export type HttpStep = { kind: "http"; name: string; url: string };
export type FrontendStep = {
  kind: "frontend";
  name: string;
  url: string;
  marker: string;
};
export type Step = ProcessStep | HttpStep | FrontendStep;
export type Runner = (step: Step) => Promise<number>;

const compose = ["docker", "compose", "-f", "docker-compose.staging.yml"];
const processStep = (
  name: string,
  command = ["bun", "run", name],
  env?: Record<string, string>,
): ProcessStep => ({ kind: "process", name, command, ...(env ? { env } : {}) });
export const defaults: Targets = {
  frontend: "http://localhost:13000",
  api: "http://localhost:13001/api/v1",
  minio: "http://localhost:19000",
  minioConsole: "http://localhost:19001",
};
const envNames: Record<keyof Targets, string> = {
  frontend: "PUBLIC_FOUNDATION_FRONTEND_URL",
  api: "PUBLIC_FOUNDATION_API_URL",
  minio: "PUBLIC_FOUNDATION_MINIO_URL",
  minioConsole: "PUBLIC_FOUNDATION_MINIO_CONSOLE_URL",
};

export function validateLocalTargets(
  targets: Targets,
  env: Record<string, string | undefined> = process.env,
): void {
  if (env.NODE_ENV === "production") throw new Error("PUBLIC_FOUNDATION_LOCAL_TARGET_REFUSED");
  const paths: Record<keyof Targets, string> = {
    frontend: "/",
    api: "/api/v1",
    minio: "/",
    minioConsole: "/",
  };
  for (const key of Object.keys(targets) as (keyof Targets)[]) {
    let url: URL;
    try {
      url = new URL(targets[key]);
    } catch {
      throw new Error("PUBLIC_FOUNDATION_LOCAL_TARGET_REFUSED");
    }
    const port = Number(url.port);
    if (
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      url.protocol !== "http:" ||
      url.username ||
      url.password ||
      !url.port ||
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65535 ||
      url.pathname !== paths[key] ||
      url.search ||
      url.hash
    )
      throw new Error("PUBLIC_FOUNDATION_LOCAL_TARGET_REFUSED");
  }
}

export function resolveTargets(env: Record<string, string | undefined> = process.env): Targets {
  const targets = Object.fromEntries(
    (Object.keys(defaults) as (keyof Targets)[]).map((key) => [
      key,
      env[envNames[key]] ?? defaults[key],
    ]),
  ) as Targets;
  validateLocalTargets(targets, env);
  return targets;
}

function publicSmokes(targets: Targets): ProcessStep[] {
  return [
    processStep("smoke:home-catalog", undefined, {
      HOME_PUBLIC_CATALOG_SMOKE_BASE_URL: targets.api,
      HOME_PUBLIC_CATALOG_SMOKE_ORIGIN: targets.frontend,
    }),
    processStep("smoke:category-catalog", undefined, {
      CATEGORY_PUBLIC_CATALOG_SMOKE_BASE_URL: targets.api,
      CATEGORY_PUBLIC_CATALOG_SMOKE_ORIGIN: targets.frontend,
    }),
    processStep("smoke:product-detail-catalog", undefined, {
      PRODUCT_DETAIL_PUBLIC_CATALOG_SMOKE_BASE_URL: targets.api,
      PRODUCT_DETAIL_PUBLIC_CATALOG_SMOKE_ORIGIN: targets.frontend,
    }),
  ];
}

function frontendSmokes(targets: Targets): FrontendStep[] {
  return [
    {
      kind: "frontend",
      name: "frontend:root",
      url: `${targets.frontend}/`,
      marker: "LIT Buy — Marketplace premium para gamers",
    },
    {
      kind: "frontend",
      name: "frontend:login",
      url: `${targets.frontend}/login`,
      marker: "Entrar na LIT Buy",
    },
  ];
}

export function buildPlan(mode: Mode, targets = defaults): Step[] {
  const health: HttpStep[] = ["live", "ready"].map((name) => ({
    kind: "http",
    name: `health:${name}`,
    url: `${targets.api}/health/${name}`,
  }));
  if (mode === "ci")
    return [
      ...frontendSmokes(targets),
      processStep("demo:seed"),
      processStep("demo:verify"),
      ...publicSmokes(targets),
      processStep("demo:seed"),
      processStep("demo:verify"),
      processStep("demo:reset"),
      processStep("demo:reset"),
    ];
  if (mode === "check")
    return [
      ...health,
      ...frontendSmokes(targets),
      processStep("demo:verify"),
      ...publicSmokes(targets),
      processStep("smoke:infra", undefined, {
        INFRA_SMOKE_BASE_URL: targets.api,
        INFRA_SMOKE_ORIGIN: targets.frontend,
      }),
    ];
  return [
    processStep("docker", ["docker", "version"]),
    processStep("compose", ["docker", "compose", "version"]),
    processStep("compose:config", [...compose, "config", "-q"]),
    processStep("compose:demo-config", [...compose, "--profile", "demo", "config", "-q"]),
    processStep("compose:up", [...compose, "up", "-d", "--build", "--wait"]),
    ...health,
    ...frontendSmokes(targets),
    processStep("demo:seed"),
    processStep("demo:verify"),
    ...publicSmokes(targets),
  ];
}

export function createDefaultRunner(fetcher: typeof fetch = fetch): Runner {
  return async (step) => {
    if (step.kind === "http" || step.kind === "frontend") {
      const response = await fetcher(step.url, {
        signal: AbortSignal.timeout(10_000),
        redirect: "error",
      });
      if (!response.ok) return 1;
      if (step.kind === "frontend") {
        const html = await response.text();
        return html.includes(step.marker) && !html.includes("Welcome to nginx!") ? 0 : 1;
      }
      return 0;
    }
    const child = Bun.spawn(step.command, {
      cwd: import.meta.dir + "/..",
      env: { ...Bun.env, ...step.env },
      stdout: "inherit",
      stderr: "inherit",
      stdin: "inherit",
    });
    return await child.exited;
  };
}

class StepFailure extends Error {
  constructor(readonly exitCode: number) {
    super("STEP_FAILED");
  }
}
export async function executePlan(
  plan: Step[],
  runner: Runner,
  logError: (message: string) => void = console.error,
): Promise<void> {
  for (const step of plan) {
    let code: number;
    try {
      code = await runner(step);
    } catch {
      logError(`Falha na etapa: ${step.name}`);
      throw new StepFailure(1);
    }
    if (code !== 0) {
      logError(`Falha na etapa: ${step.name}`);
      throw new StepFailure(code);
    }
  }
}

export function safeSummary(mode: Mode, targets = defaults) {
  const endpoints = {
    frontend: targets.frontend,
    api: targets.api,
    minioConsole: targets.minioConsole,
  };
  if (mode === "prepare")
    return {
      ok: true,
      mode,
      ...endpoints,
      demoDataRemaining: true,
      publicProducts: 6,
      publicSmokes: 3,
      frontendSmokes: 2,
    };
  if (mode === "check")
    return {
      ok: true,
      mode,
      ...endpoints,
      demoDataRemaining: true,
      verifiedPublicProducts: 6,
      publicSmokes: 3,
      infrastructureSmoke: true,
      frontendSmokes: 2,
    };
  return {
    ok: true,
    mode,
    ...endpoints,
    publicSmokes: 3,
    frontendSmokes: 2,
    secondSeedVerify: true,
    resets: 2,
    demoDataRemaining: false,
  };
}

export async function main(
  args = Bun.argv.slice(2),
  env: Record<string, string | undefined> = process.env,
  runner: Runner = createDefaultRunner(),
  log = console.log,
  logError = console.error,
): Promise<number> {
  const mode = args[0] as Mode;
  if (!(["prepare", "check", "ci"] as string[]).includes(mode)) {
    logError("PUBLIC_FOUNDATION_REHEARSAL_FAILED");
    return 2;
  }
  if (mode === "ci" && env.CI !== "true" && env.GITHUB_ACTIONS !== "true") {
    logError("PUBLIC_FOUNDATION_CI_MODE_REFUSED");
    return 2;
  }
  try {
    const targets = resolveTargets(env);
    await executePlan(buildPlan(mode, targets), runner, logError);
    log(JSON.stringify(safeSummary(mode, targets)));
    return 0;
  } catch (error) {
    if (error instanceof StepFailure) return error.exitCode;
    const code = error instanceof Error ? error.message : "";
    logError(
      code === "PUBLIC_FOUNDATION_LOCAL_TARGET_REFUSED"
        ? code
        : "PUBLIC_FOUNDATION_REHEARSAL_FAILED",
    );
    return 1;
  }
}

if (import.meta.main) process.exit(await main());
