export type Mode = "prepare" | "check" | "ci";
export type Step = { name: string; command: string[]; env?: Record<string, string> };

const compose = ["docker", "compose", "-f", "docker-compose.staging.yml"];
const bun = (name: string): Step => ({ name, command: ["bun", "run", name] });
const publicSmokes = (api: string, frontend: string): Step[] => [
  {
    name: "smoke:home-catalog",
    command: ["bun", "run", "smoke:home-catalog"],
    env: { HOME_PUBLIC_CATALOG_SMOKE_BASE_URL: api, HOME_PUBLIC_CATALOG_SMOKE_ORIGIN: frontend },
  },
  {
    name: "smoke:category-catalog",
    command: ["bun", "run", "smoke:category-catalog"],
    env: {
      CATEGORY_PUBLIC_CATALOG_SMOKE_BASE_URL: api,
      CATEGORY_PUBLIC_CATALOG_SMOKE_ORIGIN: frontend,
    },
  },
  {
    name: "smoke:product-detail-catalog",
    command: ["bun", "run", "smoke:product-detail-catalog"],
    env: {
      PRODUCT_DETAIL_PUBLIC_CATALOG_SMOKE_BASE_URL: api,
      PRODUCT_DETAIL_PUBLIC_CATALOG_SMOKE_ORIGIN: frontend,
    },
  },
];

export const defaults = {
  frontend: "http://localhost:13000",
  api: "http://localhost:13001/api/v1",
  minio: "http://localhost:19000",
  minioConsole: "http://localhost:19001",
};

export function validateLocalTargets(
  targets = defaults,
  env: Record<string, string | undefined> = process.env,
): void {
  if (env.NODE_ENV === "production") throw new Error("PUBLIC_FOUNDATION_LOCAL_TARGET_REFUSED");
  for (const [kind, value] of Object.entries(targets)) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error("PUBLIC_FOUNDATION_LOCAL_TARGET_REFUSED");
    }
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      !local ||
      url.protocol !== "http:" ||
      url.username ||
      url.password ||
      !url.port ||
      Number(url.port) > 65535
    )
      throw new Error("PUBLIC_FOUNDATION_LOCAL_TARGET_REFUSED");
    if (kind === "api" && url.pathname !== "/api/v1")
      throw new Error("PUBLIC_FOUNDATION_LOCAL_TARGET_REFUSED");
  }
}

export function buildPlan(mode: Mode, targets = defaults): Step[] {
  const health = ["live", "ready"].map((name) => ({
    name: `health:${name}`,
    command: ["curl", "--fail", "--silent", "--show-error", `${targets.api}/health/${name}`],
  }));
  if (mode === "ci")
    return [
      bun("demo:seed"),
      bun("demo:verify"),
      ...publicSmokes(targets.api, targets.frontend),
      bun("demo:seed"),
      bun("demo:verify"),
      bun("demo:reset"),
      bun("demo:reset"),
    ];
  if (mode === "check")
    return [
      ...health,
      bun("demo:verify"),
      ...publicSmokes(targets.api, targets.frontend),
      bun("smoke:infra"),
    ];
  return [
    { name: "docker", command: ["docker", "version"] },
    { name: "compose", command: ["docker", "compose", "version"] },
    { name: "compose:config", command: [...compose, "config", "-q"] },
    { name: "compose:demo-config", command: [...compose, "--profile", "demo", "config", "-q"] },
    { name: "compose:up", command: [...compose, "up", "-d", "--build", "--wait"] },
    ...health,
    bun("demo:seed"),
    bun("demo:verify"),
    ...publicSmokes(targets.api, targets.frontend),
  ];
}

export type Runner = (step: Step) => Promise<number>;
export async function executePlan(plan: Step[], runner: Runner): Promise<void> {
  for (const step of plan) {
    const code = await runner(step);
    if (code !== 0) {
      console.error(`Falha na etapa: ${step.name}`);
      throw Object.assign(new Error(step.name), { exitCode: code });
    }
  }
}
export function safeSummary(mode: Mode) {
  return {
    ok: true,
    mode,
    frontend: defaults.frontend,
    api: defaults.api,
    minioConsole: defaults.minioConsole,
    demoData: true,
    publicProducts: 6,
    publicSmokes: 3,
  };
}

export async function main(
  args = Bun.argv.slice(2),
  env = process.env,
  runner: Runner = async (step) => {
    const process = Bun.spawn(step.command, {
      cwd: import.meta.dir + "/..",
      env: { ...Bun.env, ...step.env },
      stdout: "inherit",
      stderr: "inherit",
      stdin: "inherit",
    });
    return await process.exited;
  },
): Promise<number> {
  const mode = args[0] as Mode;
  if (!(["prepare", "check", "ci"] as string[]).includes(mode)) {
    console.error("Uso: prepare | check | ci");
    return 2;
  }
  if (mode === "ci" && env.CI !== "true" && env.GITHUB_ACTIONS !== "true") {
    console.error("PUBLIC_FOUNDATION_CI_MODE_REFUSED");
    return 2;
  }
  try {
    validateLocalTargets(defaults, env);
    await executePlan(buildPlan(mode), runner);
    console.log(JSON.stringify(safeSummary(mode)));
    return 0;
  } catch (error) {
    return typeof (error as { exitCode?: unknown }).exitCode === "number"
      ? (error as { exitCode: number }).exitCode
      : 1;
  }
}

if (import.meta.main) process.exit(await main());
